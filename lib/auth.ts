import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { findLoginUser } from "@/lib/login-lookup";
import { maskPhone } from "@/lib/phone";
import type { Role } from "@prisma/client";

class AccountLocked extends CredentialsSignin {
  code = "locked";
}

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      userId: string;
      role: Role;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    id: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Contact number or User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const typed = (credentials?.identifier as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!typed || !password) return null;
        // Numbers are masked in the log so a phone number never sits there in full.
        const loginId = /^[+\d\s()-]+$/.test(typed) ? maskPhone(typed) : typed.toUpperCase();

        const user = await findLoginUser(typed);
        const failed = (actor: Parameters<typeof logAudit>[0]["actor"], reason: string) =>
          logAudit({
            actor,
            action: "login_failed",
            module: "Authentication",
            entityType: "Session",
            entityId: user?.id ?? null,
            description: reason,
            status: "FAILED",
            failureReason: reason,
          });

        if (!user) {
          await failed({ userId: loginId }, "Unknown contact number or User ID");
          return null;
        }
        const actor = { id: user.id, userId: user.userId, name: user.name, role: user.role };

        if (user.status !== "ACTIVE") {
          await failed(actor, "Account is inactive");
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await failed(actor, "Sign-in blocked: account is locked");
          throw new AccountLocked();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const security = (await getSettings()).security;
          const maxAttempts = Number(security.maxLoginAttempts);
          await failed(actor, "Invalid password");
          if (maxAttempts > 0) {
            const attempts = user.failedLogins + 1;
            if (attempts >= maxAttempts) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  failedLogins: 0,
                  lockedUntil: new Date(Date.now() + Number(security.lockMinutes) * 60000),
                },
              });
              await logAudit({
                actor,
                action: "account_locked",
                module: "Authentication",
                entityType: "Session",
                entityId: user.id,
                description: `Account locked for ${security.lockMinutes} minutes after ${maxAttempts} wrong passwords in a row`,
              });
            } else {
              await prisma.user.update({ where: { id: user.id }, data: { failedLogins: attempts } });
            }
          }
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
        });
        await logAudit({
          actor,
          action: "login",
          module: "Authentication",
          entityType: "Session",
          entityId: user.id,
          description: "Successful login",
        });

        return {
          id: user.id,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});

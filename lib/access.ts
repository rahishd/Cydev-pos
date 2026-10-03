import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export type Access = {
  id: string;
  userId: string;
  name: string;
  role: "OWNER" | "STAFF";
  isOwner: boolean;
  permissions: string[];
  /** 0 when the person has no profile photo; changes whenever the photo does, so browsers refetch it. */
  avatarVersion: number;
  can: (permission: string) => boolean;
};

/**
 * Reads the signed-in user's role and permissions from the database on every request, so an
 * Owner's change (or a deactivation) takes effect immediately instead of when the token expires.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, userId: true, name: true, role: true, status: true, permissions: true, avatarVersion: true },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const isOwner = user.role === "OWNER";
  const set = new Set(user.permissions);
  return {
    id: user.id,
    userId: user.userId,
    name: user.name,
    role: user.role,
    isOwner,
    permissions: user.permissions,
    avatarVersion: user.avatarVersion,
    can: (p: string) => isOwner || set.has(p),
  };
});

/** For pages: sends signed-out/deactivated users to logout, and users without access to /forbidden. */
export async function requirePermission(...anyOf: string[]): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/api/logout");
  if (anyOf.length > 0 && !anyOf.some((p) => access.can(p))) redirect("/forbidden");
  return access;
}

export async function requireOwner(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/api/logout");
  if (!access.isOwner) redirect("/forbidden");
  return access;
}

/** For server actions: throws so the caller sees a clear message. */
export async function assertPermission(...anyOf: string[]): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new Error("Your account is not active. Please sign in again.");
  if (anyOf.length > 0 && !anyOf.some((p) => access.can(p))) {
    const area = anyOf[0].split(".")[0];
    await logAudit({
      actor: access,
      action: "access_denied",
      title: "Access Denied",
      module: area.charAt(0).toUpperCase() + area.slice(1),
      entityType: "Permission",
      description: `Tried an action that needs: ${anyOf.join(" or ")}`,
      status: "FAILED",
      failureReason: "Permission denied",
    });
    throw new Error("You don't have permission to do this. Please ask the Owner.");
  }
  return access;
}

export async function assertOwner(): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new Error("Your account is not active. Please sign in again.");
  if (!access.isOwner) {
    await logAudit({
      actor: access,
      action: "access_denied",
      title: "Access Denied",
      module: "Users",
      entityType: "Permission",
      description: "Tried an Owner-only action",
      status: "FAILED",
      failureReason: "Owner only",
    });
    throw new Error("Only the Owner can do this.");
  }
  return access;
}

const HOME_ORDER: [string[], string][] = [
  [["dashboard.view"], "/dashboard"],
  [["sales.create", "sales.history", "sales.return", "sales.exchange"], "/sales"],
  [["products.view"], "/products"],
  [["inventory.view"], "/inventory"],
  [["customers.view"], "/customers"],
  [["purchases.view"], "/purchases"],
  [["expenses.view"], "/expenses"],
];

/** The first page this person is allowed to open (used when they can't see the dashboard). */
export function homePath(access: Access): string {
  for (const [perms, path] of HOME_ORDER) {
    if (perms.some((p) => access.can(p))) return path;
  }
  return "/forbidden";
}

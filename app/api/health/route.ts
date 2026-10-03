import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Safe to expose: reports only whether settings exist and whether the database answers; no values.
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  };

  const check = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await fn();
      return { name, ok: true, ms: Date.now() - t };
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e))
        .split("\n")
        .filter(Boolean)
        .slice(-1)[0]
        .replace(/[a-z0-9.-]+\.neon\.tech(:\d+)?/gi, "<db-host>")
        .slice(0, 160);
      return { name, ok: false, ms: Date.now() - t, error: msg };
    }
  };

  const checks = [
    await check("database connection", () => prisma.$queryRaw`SELECT 1`),
    await check("users table (login ID column)", () => prisma.user.findFirst({ select: { userId: true } })),
    await check("settings table", () => prisma.systemSettings.findFirst({ select: { data: true } })),
    await check("audit log table", () => prisma.auditLog.findFirst({ select: { auditNo: true } })),
  ];

  const ok = env.DATABASE_URL && env.AUTH_SECRET && checks.every((c) => c.ok);
  return NextResponse.json({ ok, env, checks }, { status: ok ? 200 : 500 });
}

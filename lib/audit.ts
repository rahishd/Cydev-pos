import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditActor = {
  id?: string | null;
  userId?: string | null;
  name?: string | null;
  role?: string | null;
};

export type AuditEvent = {
  actor?: AuditActor | null;
  /** Machine code such as "created", "adjustment", "login_failed". */
  action: string;
  /** Short readable heading, e.g. "Created Sale". */
  title?: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  previous?: unknown;
  next?: unknown;
  reason?: string;
  status?: "SUCCESS" | "FAILED";
  failureReason?: string;
};

function parseDevice(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} / ${os}`;
}

async function clientInfo(): Promise<{ ip: string | null; device: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
    return { ip, device: parseDevice(h.get("user-agent")) };
  } catch {
    return { ip: null, device: null };
  }
}

/**
 * Appends one entry to the audit trail. It never throws: a logging problem must not break the
 * sale, stock change or sign-in it describes.
 */
export async function logAudit(e: AuditEvent): Promise<void> {
  try {
    const { ip, device } = await clientInfo();
    await prisma.auditLog.create({
      data: {
        userId: e.actor?.id ?? null,
        userCode: e.actor?.userId ?? null,
        userName: e.actor?.name ?? null,
        userRole: e.actor?.role ?? null,
        action: e.action,
        title: e.title ?? null,
        module: e.module,
        affectedType: e.entityType,
        affectedId: e.entityId ?? null,
        description: e.description,
        previousValue: e.previous === undefined ? undefined : (e.previous as object),
        newValue: e.next === undefined ? undefined : (e.next as object),
        reason: e.reason ?? null,
        status: e.status ?? "SUCCESS",
        failureReason: e.failureReason ?? null,
        ipAddress: ip,
        device,
      },
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

export const npr = (n: number | string) =>
  `NPR ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

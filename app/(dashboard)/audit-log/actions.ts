"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { ACTION_GROUPS, AUDIT_ID, AUDIT_MODULES, actionLabel, actionsInGroup, moduleFromType } from "@/lib/audit-meta";

export type AuditFilters = {
  q?: string;
  userId?: string;
  module?: string;
  actionGroup?: string;
  status?: string;
  range?: "today" | "yesterday" | "7d" | "30d" | "custom" | "";
  from?: string;
  to?: string;
  page?: number;
};

export type AuditListRow = {
  id: string;
  auditNo: number;
  auditId: string;
  createdAt: string;
  userName: string;
  userCode: string;
  userRole: string;
  title: string;
  action: string;
  module: string;
  description: string;
  status: string;
};

export type AuditDetail = AuditListRow & {
  entityType: string;
  entityId: string | null;
  previous: unknown;
  next: unknown;
  reason: string | null;
  failureReason: string | null;
  ipAddress: string | null;
  device: string | null;
};

const PAGE_SIZE = 25;
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000;

/** Midnight (Nepal time) of the day `daysAgo` days back, as a UTC instant. */
function nepalDayStart(daysAgo = 0, from = new Date()): Date {
  const local = new Date(from.getTime() + NEPAL_OFFSET_MS);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo);
  return new Date(startLocal - NEPAL_OFFSET_MS);
}

function nepalDateInput(value: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const startLocal = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (endOfDay ? 1 : 0));
  return new Date(startLocal - NEPAL_OFFSET_MS);
}

function buildWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  if (f.userId) and.push({ OR: [{ userId: f.userId }, { userCode: f.userId }] });
  if (f.module) and.push({ module: f.module });
  if (f.status) and.push({ status: f.status });

  if (f.actionGroup) {
    if (f.actionGroup === "other") {
      const known = ACTION_GROUPS.flatMap((g) => actionsInGroup(g.value));
      and.push({ action: { notIn: known } });
    } else {
      and.push({ action: { in: actionsInGroup(f.actionGroup) } });
    }
  }

  const now = new Date();
  let gte: Date | undefined;
  let lt: Date | undefined;
  switch (f.range) {
    case "today":
      gte = nepalDayStart(0, now);
      break;
    case "yesterday":
      gte = nepalDayStart(1, now);
      lt = nepalDayStart(0, now);
      break;
    case "7d":
      gte = nepalDayStart(6, now);
      break;
    case "30d":
      gte = nepalDayStart(29, now);
      break;
    case "custom":
      gte = (f.from && nepalDateInput(f.from)) || undefined;
      lt = (f.to && nepalDateInput(f.to, true)) || undefined;
      break;
  }
  if (gte || lt) and.push({ createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } });

  const q = f.q?.trim();
  if (q) {
    const idMatch = /^AUD-?0*(\d+)$/i.exec(q);
    const or: Prisma.AuditLogWhereInput[] = [
      { description: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { userName: { contains: q, mode: "insensitive" } },
      { userCode: { contains: q, mode: "insensitive" } },
      { affectedId: { contains: q, mode: "insensitive" } },
      { affectedType: { contains: q, mode: "insensitive" } },
      { action: { contains: q.replace(/\s+/g, "_").toLowerCase() } },
    ];
    if (idMatch) or.push({ auditNo: Number(idMatch[1]) });
    and.push({ OR: or });
  }

  return and.length ? { AND: and } : {};
}

type Row = Prisma.AuditLogGetPayload<{
  select: {
    id: true; auditNo: true; createdAt: true; userName: true; userCode: true; userRole: true; action: true;
    title: true; module: true; affectedType: true; description: true; status: true;
    user: { select: { name: true; userId: true; role: true } };
  };
}>;

function toRow(r: Row): AuditListRow {
  return {
    id: r.id,
    auditNo: r.auditNo,
    auditId: AUDIT_ID(r.auditNo),
    createdAt: r.createdAt.toISOString(),
    userName: r.userName ?? r.user?.name ?? "Unknown",
    userCode: r.userCode ?? r.user?.userId ?? "",
    userRole: r.userRole ?? r.user?.role ?? "",
    title: actionLabel(r.action, r.title, r.affectedType),
    action: r.action,
    module: r.module || moduleFromType(r.affectedType),
    description: r.description ?? "",
    status: r.status,
  };
}

const rowSelect = {
  id: true,
  auditNo: true,
  createdAt: true,
  userName: true,
  userCode: true,
  userRole: true,
  action: true,
  title: true,
  module: true,
  affectedType: true,
  description: true,
  status: true,
  user: { select: { name: true, userId: true, role: true } },
} as const;

export async function getAuditSummary() {
  await assertPermission("audit.view");
  const since = nepalDayStart(0);
  const base = { createdAt: { gte: since } };
  const [today, logins, changes, failed] = await Promise.all([
    prisma.auditLog.count({ where: base }),
    prisma.auditLog.count({ where: { ...base, action: "login" } }),
    prisma.auditLog.count({
      where: {
        ...base,
        action: {
          in: ["created", "updated", "deleted", "payment", "return", "exchange", "adjustment", "price_changed", "received", "cancelled", "activated", "deactivated", "permissions_changed", "settings_changed", "password_reset", "status_changed"],
        },
      },
    }),
    prisma.auditLog.count({ where: { ...base, status: "FAILED" } }),
  ]);
  return { today, logins, changes, failed };
}

export async function getAuditFilterOptions() {
  await assertPermission("audit.view");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, userId: true },
    orderBy: { name: "asc" },
  });
  return { users, modules: [...AUDIT_MODULES], actionGroups: ACTION_GROUPS.map((g) => ({ ...g })) };
}

export async function getAuditLog(filters: AuditFilters) {
  await assertPermission("audit.view");
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { auditNo: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: rowSelect,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows: rows.map(toRow), total, pageSize: PAGE_SIZE };
}

export async function getAuditEntry(id: string): Promise<AuditDetail | null> {
  await assertPermission("audit.view");
  const r = await prisma.auditLog.findUnique({
    where: { id },
    select: {
      ...rowSelect,
      affectedId: true,
      previousValue: true,
      newValue: true,
      reason: true,
      failureReason: true,
      ipAddress: true,
      device: true,
    },
  });
  if (!r) return null;
  return {
    ...toRow(r),
    entityType: r.affectedType,
    entityId: r.affectedId,
    previous: r.previousValue,
    next: r.newValue,
    reason: r.reason,
    failureReason: r.failureReason,
    ipAddress: r.ipAddress,
    device: r.device,
  };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportAuditLog(filters: AuditFilters) {
  const access = await assertPermission("audit.view");
  const rows = await prisma.auditLog.findMany({
    where: buildWhere(filters),
    orderBy: { auditNo: "desc" },
    take: 5000,
    select: { ...rowSelect, affectedId: true, reason: true, failureReason: true, ipAddress: true, device: true },
  });
  const header = ["Audit ID", "Date & Time", "User ID", "User", "Role", "Action", "Module", "Description", "Status", "Failure reason", "IP", "Device"];
  const lines = rows.map((r) => {
    const base = toRow(r);
    return [
      base.auditId,
      new Date(r.createdAt).toISOString(),
      base.userCode,
      base.userName,
      base.userRole,
      base.title,
      base.module,
      base.description,
      base.status,
      r.failureReason ?? "",
      r.ipAddress ?? "",
      r.device ?? "",
    ].map(csvCell).join(",");
  });
  await logAudit({
    actor: access,
    action: "export",
    title: "Audit Log Exported",
    module: "Backup",
    entityType: "AuditLog",
    description: `Exported ${rows.length} audit log entr${rows.length === 1 ? "y" : "ies"} to CSV`,
  });
  return {
    filename: `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [header.join(","), ...lines].join("\n"),
    count: rows.length,
  };
}



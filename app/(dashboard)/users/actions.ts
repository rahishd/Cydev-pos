"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertOwner } from "@/lib/access";
import { DEFAULT_STAFF_PERMISSIONS, sanitizePermissions } from "@/lib/permissions";
import { passwordProblem } from "@/lib/password";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { PERMISSION_GROUPS } from "@/lib/permissions";

export type StaffRow = {
  id: string;
  userId: string;
  name: string;
  contactNumber: string | null;
  role: "OWNER" | "STAFF";
  status: "ACTIVE" | "DISABLED";
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type UsersPageData = {
  users: StaffRow[];
  stats: { total: number; active: number; inactive: number; staff: number };
  currentUserId: string;
};

const USER_ID_PATTERN = /^[A-Z0-9_-]{3,20}$/;

const staffSelect = {
  id: true,
  userId: true,
  name: true,
  contactNumber: true,
  role: true,
  status: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} as const;

async function nextUserId(): Promise<string> {
  const rows = await prisma.user.findMany({ select: { userId: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^U(\d+)$/.exec(r.userId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "U" + String(max + 1).padStart(3, "0");
}

async function activeOwnerCount(excludingId?: string) {
  return prisma.user.count({
    where: { role: "OWNER", status: "ACTIVE", ...(excludingId ? { id: { not: excludingId } } : {}) },
  });
}

export async function getUsersPageData(): Promise<UsersPageData> {
  const me = await assertOwner();
  const rows = await prisma.user.findMany({
    select: staffSelect,
    orderBy: { createdAt: "asc" },
  });

  const users: StaffRow[] = rows.map((u) => ({
    id: u.id,
    userId: u.userId,
    name: u.name,
    contactNumber: u.contactNumber,
    role: u.role,
    status: u.status,
    permissions: u.permissions,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    createdByName: u.createdBy?.name ?? null,
  }));

  return {
    users,
    stats: {
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      inactive: users.filter((u) => u.status === "DISABLED").length,
      staff: users.filter((u) => u.role === "STAFF").length,
    },
    currentUserId: me.id,
  };
}

export async function suggestUserId(): Promise<string> {
  await assertOwner();
  return nextUserId();
}

export async function createStaff(input: {
  name: string;
  contactNumber?: string;
  userId: string;
  password: string;
  role: "OWNER" | "STAFF";
  status: "ACTIVE" | "DISABLED";
}) {
  const me = await assertOwner();

  const name = input.name.trim();
  const userId = input.userId.trim().toUpperCase();
  if (!name) throw new Error("Full name is required");
  if (!USER_ID_PATTERN.test(userId)) {
    throw new Error("User ID must be 3-20 characters: letters, numbers, - or _");
  }
  {
    const problem = passwordProblem(input.password, (await getSettings()).security);
    if (problem) throw new Error(problem);
  }
  if (await prisma.user.findUnique({ where: { userId } })) {
    throw new Error(`User ID ${userId} is already taken`);
  }

  const permissions = input.role === "OWNER" ? [] : DEFAULT_STAFF_PERMISSIONS;
  const user = await prisma.user.create({
    data: {
      userId,
      name,
      contactNumber: input.contactNumber?.trim() || null,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      status: input.status,
      permissions,
      createdById: me.id,
    },
    select: { id: true },
  });

  await logAudit({
    actor: me,
    action: "created",
    title: "Created Staff Account",
    module: "Users",
    entityType: "User",
    entityId: user.id,
    description: `Created ${input.role === "OWNER" ? "owner" : "staff"} account ${userId} (${name})`,
    next: { userId, name, role: input.role, status: input.status, permissions },
  });

  revalidatePath("/users");
  return { id: user.id, userId, password: input.password };
}

export async function updateStaff(input: {
  id: string;
  name: string;
  contactNumber?: string;
  role: "OWNER" | "STAFF";
}) {
  const me = await assertOwner();
  const name = input.name.trim();
  if (!name) throw new Error("Full name is required");

  const existing = await prisma.user.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Staff account not found");

  if (existing.role === "OWNER" && input.role === "STAFF") {
    if (existing.id === me.id) throw new Error("You can't remove your own Owner role");
    if ((await activeOwnerCount(existing.id)) === 0) {
      throw new Error("There must be at least one active Owner");
    }
  }

  await prisma.user.update({
    where: { id: input.id },
    data: {
      name,
      contactNumber: input.contactNumber?.trim() || null,
      role: input.role,
      ...(input.role === "OWNER" ? { permissions: [] } : {}),
    },
  });

  await logAudit({
    actor: me,
    action: "updated",
    title: "Edited Staff Information",
    module: "Users",
    entityType: "User",
    entityId: input.id,
    description: `Edited staff information for ${existing.userId} (${existing.name})`,
    previous: { name: existing.name, contactNumber: existing.contactNumber, role: existing.role },
    next: { name, contactNumber: input.contactNumber?.trim() || null, role: input.role },
  });

  revalidatePath("/users");
}

export async function setStaffStatus(id: string, status: "ACTIVE" | "DISABLED") {
  const me = await assertOwner();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("Staff account not found");

  if (status === "DISABLED") {
    if (existing.id === me.id) throw new Error("You can't deactivate your own account");
    if (existing.role === "OWNER" && (await activeOwnerCount(existing.id)) === 0) {
      throw new Error("There must be at least one active Owner");
    }
  }

  await prisma.user.update({ where: { id }, data: { status } });
  await logAudit({
    actor: me,
    action: status === "ACTIVE" ? "activated" : "deactivated",
    title: status === "ACTIVE" ? "Reactivated Staff Account" : "Deactivated Staff Account",
    module: "Users",
    entityType: "User",
    entityId: id,
    description: `${status === "ACTIVE" ? "Reactivated" : "Deactivated"} ${existing.userId} (${existing.name})`,
    previous: { status: existing.status },
    next: { status },
  });

  revalidatePath("/users");
}

export async function setStaffPassword(id: string, password: string) {
  const me = await assertOwner();
  {
    const problem = passwordProblem(password, (await getSettings()).security);
    if (problem) throw new Error(problem);
  }
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { userId: true, name: true, lockedUntil: true },
  });
  if (!existing) throw new Error("Staff account not found");

  const wasLocked = !!existing.lockedUntil && existing.lockedUntil > new Date();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, lockedUntil: null },
  });
  await logAudit({
    actor: me,
    action: "password_reset",
    title: "Reset Password",
    module: "Authentication",
    entityType: "User",
    entityId: id,
    description: `Password set by Owner for ${existing.userId} (${existing.name})`,
  });
  if (wasLocked) {
    await logAudit({
      actor: me,
      action: "account_unlocked",
      title: "Account Unlocked",
      module: "Authentication",
      entityType: "User",
      entityId: id,
      description: `${existing.userId} (${existing.name}) was unlocked by the password reset`,
    });
  }

  revalidatePath("/users");
  return { userId: existing.userId, password };
}

export async function updateStaffPermissions(id: string, permissions: string[]) {
  const me = await assertOwner();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("Staff account not found");
  if (existing.role === "OWNER") throw new Error("Owners always have full access");

  const next = sanitizePermissions(permissions);
  await prisma.user.update({ where: { id }, data: { permissions: next } });
  const label = (k: string) =>
    PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).find((i) => i.key === k)?.label ?? k;
  const added = next.filter((k) => !existing.permissions.includes(k)).map(label);
  const removed = existing.permissions.filter((k) => !next.includes(k)).map(label);
  await logAudit({
    actor: me,
    action: "permissions_changed",
    title: "Changed Staff Permissions",
    module: "Users",
    entityType: "User",
    entityId: id,
    description:
      `Changed permissions for ${existing.userId} (${existing.name})` +
      (added.length ? `. Enabled: ${added.join(", ")}` : "") +
      (removed.length ? `. Disabled: ${removed.join(", ")}` : "") +
      (!added.length && !removed.length ? ". No change" : ""),
    previous: { permissions: existing.permissions },
    next: { permissions: next },
  });

  revalidatePath("/users");
}

export type ActivityRow = {
  id: string;
  label: string;
  createdAt: string;
};

const pretty = (s: string) => s.replace(/_/g, " ");

export async function getStaffActivity(id: string): Promise<ActivityRow[]> {
  await assertOwner();
  const [logs, sales, moves] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, action: true, affectedType: true, createdAt: true },
    }),
    prisma.sale.findMany({
      where: { staffId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, invoiceNo: true, total: true, createdAt: true },
    }),
    prisma.stockMovement.findMany({
      where: { createdById: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        quantityChange: true,
        createdAt: true,
        productVariant: { select: { product: { select: { name: true } } } },
      },
    }),
  ]);

  const rows: (ActivityRow & { t: number })[] = [
    ...logs.map((l) => ({
      id: "a" + l.id,
      label: `${pretty(l.action)} ${l.affectedType.toLowerCase()}`,
      createdAt: l.createdAt.toISOString(),
      t: l.createdAt.getTime(),
    })),
    ...sales.map((x) => ({
      id: "s" + x.id,
      label: `Sale ${x.invoiceNo} - NPR ${Number(x.total).toLocaleString("en-US")}`,
      createdAt: x.createdAt.toISOString(),
      t: x.createdAt.getTime(),
    })),
    ...moves.map((m) => ({
      id: "m" + m.id,
      label: `Stock ${pretty(m.type.toLowerCase())}: ${m.productVariant.product.name} (${m.quantityChange > 0 ? "+" : ""}${m.quantityChange})`,
      createdAt: m.createdAt.toISOString(),
      t: m.createdAt.getTime(),
    })),
  ];

  return rows
    .sort((x, y) => y.t - x.t)
    .slice(0, 30)
    .map(({ t: _t, ...r }) => r);
}

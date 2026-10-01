"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";

export interface UsersPageData {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>;
  stats: {
    total: number;
    active: number;
    inactive: number;
    staff: number;
  };
}

export async function getUsersPageData(): Promise<UsersPageData> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can access user management");
  }

  const [users, total, active, inactive, staff] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "DISABLED" } }),
    prisma.user.count({ where: { role: "STAFF" } }),
  ]);

  return {
    users,
    stats: { total, active, inactive, staff },
  };
}

export async function createUser({
  name,
  email,
  password,
  role,
  status,
}: {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can create users");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: (role as "OWNER" | "STAFF") || "STAFF",
      status: (status as "ACTIVE" | "DISABLED") || "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "created",
      affectedType: "User",
      affectedId: user.id,
      newValue: {
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    },
  });

  revalidatePath("/users");
  return user;
}

export async function updateUser({
  id,
  name,
  email,
  role,
  status,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can update users");
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });
  if (!existing) throw new Error("User not found");

  const emailExists = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id },
    },
  });
  if (emailExists) throw new Error("Email already in use");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role: (role as "OWNER" | "STAFF") || "STAFF",
      status: (status as "ACTIVE" | "DISABLED") || "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "updated",
      affectedType: "User",
      affectedId: id,
      previousValue: existing,
      newValue: {
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
      },
    },
  });

  revalidatePath("/users");
  return updated;
}

export async function deactivateUser(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can deactivate users");
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) throw new Error("User not found");

  const updated = await prisma.user.update({
    where: { id },
    data: { status: "DISABLED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "updated",
      affectedType: "User",
      affectedId: id,
      previousValue: { status: user.status },
      newValue: { status: "DISABLED" },
    },
  });

  revalidatePath("/users");
  return updated;
}

export async function activateUser(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can activate users");
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) throw new Error("User not found");

  const updated = await prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "updated",
      affectedType: "User",
      affectedId: id,
      previousValue: { status: user.status },
      newValue: { status: "ACTIVE" },
    },
  });

  revalidatePath("/users");
  return updated;
}

export async function resetUserPassword(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can reset passwords");
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) throw new Error("User not found");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "updated",
      affectedType: "User",
      affectedId: id,
      newValue: { passwordReset: true },
    },
  });

  revalidatePath("/users");
  return tempPassword;
}

export async function updateUserLoginTime(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

"use server";

import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";
import { moduleFromType } from "@/lib/audit-meta";

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  module: string;
  who: string;
  mine: boolean;
  at: string;
};

/** Which permissions let a staff member see activity in each area. Owners (and audit viewers) see everything. */
const MODULE_NEEDS: Record<string, string[]> = {
  Products: ["products.view"],
  Inventory: ["inventory.view", "inventory.history"],
  Sales: ["sales.history", "sales.create"],
  Customers: ["customers.view"],
  Suppliers: ["suppliers.view"],
  Expenses: ["expenses.view"],
};

const SKIP_ACTIONS = ["login", "logout", "login_failed", "account_locked", "account_unlocked"];

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const access = await getAccess();
  if (!access) return [];

  const seeAll = access.isOwner || access.can("audit.view");
  const rows = await prisma.auditLog.findMany({
    where: {
      status: "SUCCESS",
      action: { notIn: SKIP_ACTIONS },
    },
    orderBy: { createdAt: "desc" },
    take: seeAll ? 40 : 150,
    select: {
      id: true,
      userId: true,
      userName: true,
      title: true,
      action: true,
      module: true,
      affectedType: true,
      description: true,
      createdAt: true,
    },
  });

  const items: ActivityItem[] = [];
  for (const r of rows) {
    const module = r.module || moduleFromType(r.affectedType);
    if (!seeAll) {
      const needs = MODULE_NEEDS[module];
      if (!needs || !needs.some((p) => access.can(p))) continue;
    }
    const mine = r.userId === access.id;
    items.push({
      id: r.id,
      title: r.title || r.action.replace(/_/g, " "),
      description: r.description ?? "",
      module,
      who: mine ? "You" : r.userName || "System",
      mine,
      at: r.createdAt.toISOString(),
    });
    if (items.length >= 40) break;
  }
  return items;
}

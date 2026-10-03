"use server";

import { assertPermission } from "@/lib/access";
import { logAudit, npr } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import type { ExpenseStatus, PaymentMethod } from "@prisma/client";
import { headers } from "next/headers";
import { expenseToken, expenseReportToken, type ExpenseReportFilters } from "@/lib/invoice-link";

export interface ExpensesPageData {
  expenses: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    amount: number;
    date: Date;
    paymentMethod: string;
    status: string;
    description: string | null;
    attachmentUrl: string | null;
    createdById: string;
    createdByName: string;
    createdAt: Date;
  }>;
  categories: Array<{
    id: string;
    name: string;
  }>;
  stats: {
    totalThisMonth: number;
    totalToday: number;
    largestCategory: {
      name: string;
      total: number;
    } | null;
    unpaidTotal: number;
  };
}

export async function getExpensesPageData(): Promise<ExpensesPageData> {
  await assertPermission("expenses.view");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Fetch expenses with relationships
  const expenses = await prisma.expense.findMany({
    select: {
      id: true,
      categoryId: true,
      amount: true,
      date: true,
      paymentMethod: true,
      status: true,
      description: true,
      attachmentUrl: true,
      createdById: true,
      createdAt: true,
      category: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { date: "desc" },
  });

  // Fetch categories
  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Calculate stats
  const thisMonthExpenses = expenses.filter(
    (e) => e.date >= monthStart && e.date < new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
  );
  const todayExpenses = expenses.filter((e) => {
    const eDate = new Date(e.date);
    eDate.setHours(0, 0, 0, 0);
    return eDate.getTime() === today.getTime();
  });

  const totalThisMonth = thisMonthExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount.toString()),
    0
  );
  const totalToday = todayExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount.toString()),
    0
  );

  // Calculate largest category
  const categoryTotals: { [key: string]: { name: string; total: number } } =
    {};
  expenses.forEach((e) => {
    const amount = parseFloat(e.amount.toString());
    if (!categoryTotals[e.categoryId]) {
      categoryTotals[e.categoryId] = { name: e.category.name, total: 0 };
    }
    categoryTotals[e.categoryId].total += amount;
  });

  let largestCategory = null;
  let maxTotal = 0;
  for (const cat of Object.values(categoryTotals)) {
    if (cat.total > maxTotal) {
      maxTotal = cat.total;
      largestCategory = cat;
    }
  }

  const unpaidTotal = expenses
    .filter((e) => e.status === "UNPAID")
    .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

  const expensesData = expenses.map((e) => ({
    ...e,
    amount: parseFloat(e.amount.toString()),
    categoryName: e.category.name,
    createdByName: e.createdBy.name,
  }));

  return {
    expenses: expensesData,
    categories,
    stats: {
      totalThisMonth,
      totalToday,
      largestCategory,
      unpaidTotal,
    },
  };
}

export async function createExpense({
  categoryId,
  amount,
  date,
  paymentMethod,
  status = "PAID",
  description,
  attachmentUrl,
}: {
  categoryId: string;
  amount: number;
  date: Date;
  paymentMethod: string;
  status?: string;
  description?: string;
  attachmentUrl?: string;
}) {
  await assertPermission("expenses.add");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Validate category exists
  const category = await prisma.expenseCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new Error("Category not found");
  if (!category.isActive) throw new Error("That category is inactive. Choose another or reactivate it in Settings.");

  const expense = await prisma.expense.create({
    data: {
      categoryId,
      amount: new Decimal(amount.toString()),
      date,
      paymentMethod: paymentMethod as PaymentMethod,
      status: status as ExpenseStatus,
      description: description || null,
      attachmentUrl: attachmentUrl || null,
      createdById: session.user.id,
    },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  await logAudit({
    actor: { id: session.user.id, userId: session.user.userId, name: session.user.name, role: session.user.role },
    action: "created",
    title: "Created Expense",
    module: "Expenses",
    entityType: "Expense",
    entityId: expense.id,
    description: `Created expense: ${expense.category.name}, ${npr(expense.amount.toString())} (${expense.paymentMethod.replace(/_/g, " ")}, ${expense.status})`,
    next: {
      category: expense.category.name,
      amount: Number(expense.amount),
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      description: expense.description,
    },
  });

  revalidatePath("/expenses");
  return { id: expense.id };
}

export async function updateExpense({
  id,
  categoryId,
  amount,
  date,
  paymentMethod,
  status,
  description,
  attachmentUrl,
}: {
  id: string;
  categoryId: string;
  amount: number;
  date: Date;
  paymentMethod: string;
  status: string;
  description?: string;
  attachmentUrl?: string;
}) {
  await assertPermission("expenses.edit");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.expense.findUnique({
    where: { id },
    select: {
      categoryId: true,
      amount: true,
      paymentMethod: true,
      status: true,
      description: true,
      attachmentUrl: true,
    },
  });
  if (!existing) throw new Error("Expense not found");

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      categoryId,
      amount: new Decimal(amount.toString()),
      date,
      paymentMethod: paymentMethod as PaymentMethod,
      status: status as ExpenseStatus,
      description: description || null,
      attachmentUrl: attachmentUrl || null,
    },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  {
    const [oldCat, newCat] = await Promise.all([
      prisma.expenseCategory.findUnique({ where: { id: existing.categoryId }, select: { name: true } }),
      prisma.expenseCategory.findUnique({ where: { id: updated.categoryId }, select: { name: true } }),
    ]);
    const before = {
      category: oldCat?.name ?? existing.categoryId,
      amount: Number(existing.amount),
      paymentMethod: existing.paymentMethod,
      status: existing.status,
      description: existing.description,
    };
    const after = {
      category: newCat?.name ?? updated.categoryId,
      amount: Number(updated.amount),
      paymentMethod: updated.paymentMethod,
      status: updated.status,
      description: updated.description,
    };
    const changes = (Object.keys(after) as (keyof typeof after)[])
      .filter((k) => before[k] !== after[k])
      .map((k) => `${k}: ${before[k] ?? "-"} -> ${after[k] ?? "-"}`);
    await logAudit({
      actor: { id: session.user.id, userId: session.user.userId, name: session.user.name, role: session.user.role },
      action: "updated",
      title: "Edited Expense",
      module: "Expenses",
      entityType: "Expense",
      entityId: id,
      description: `Edited expense (${after.category}, ${npr(after.amount)})${changes.length ? ": " + changes.join("; ") : ""}`,
      previous: before,
      next: after,
    });
  }

  revalidatePath("/expenses");
  return { id: updated.id };
}

export async function deleteExpense(id: string) {
  await assertPermission("expenses.delete");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");


  const expense = await prisma.expense.findUnique({
    where: { id },
  });
  if (!expense) throw new Error("Expense not found");

  {
    const cat = await prisma.expenseCategory.findUnique({ where: { id: expense.categoryId }, select: { name: true } });
    await logAudit({
      actor: { id: session.user.id, userId: session.user.userId, name: session.user.name, role: session.user.role },
      action: "deleted",
      title: "Deleted Expense",
      module: "Expenses",
      entityType: "Expense",
      entityId: id,
      description: `Deleted expense: ${cat?.name ?? "-"}, ${npr(expense.amount.toString())}`,
      previous: {
        category: cat?.name ?? expense.categoryId,
        amount: Number(expense.amount),
        paymentMethod: expense.paymentMethod,
        status: expense.status,
        description: expense.description,
      },
    });
  }

  await prisma.expense.delete({
    where: { id },
  });

  revalidatePath("/expenses");
}

export async function createExpenseCategory(name: string) {
  await assertPermission("expenses.add");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");


  const category = await prisma.expenseCategory.create({
    data: { name },
  });

  revalidatePath("/expenses");
  return category;
}

async function appOrigin() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
}

export async function getExpenseShareUrl(id: string) {
  await assertPermission("expenses.export");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return `${await appOrigin()}/api/expense/${id}?t=${expenseToken(id)}`;
}

export async function getExpenseReportShareUrl(filters: ExpenseReportFilters) {
  await assertPermission("expenses.export");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const f = {
    from: filters.from ?? "",
    to: filters.to ?? "",
    category: filters.category ?? "",
    method: filters.method ?? "",
    status: filters.status ?? "",
    q: filters.q ?? "",
  };
  const qs = new URLSearchParams({ ...f, t: expenseReportToken(f) });
  return `${await appOrigin()}/api/expense-report?${qs.toString()}`;
}

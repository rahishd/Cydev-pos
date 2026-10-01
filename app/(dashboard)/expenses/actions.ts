"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

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
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Calculate stats
  const thisMonthExpenses = expenses.filter(
    (e) => e.date >= monthStart && e.date <= today
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

  // Calculate unpaid total
  const unpaidExpenses = expenses.filter((e) => e.status === "UNPAID");
  const unpaidTotal = unpaidExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount.toString()),
    0
  );

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
  status,
  description,
  attachmentUrl,
}: {
  categoryId: string;
  amount: number;
  date: Date;
  paymentMethod: string;
  status: string;
  description?: string;
  attachmentUrl?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Validate category exists
  const category = await prisma.expenseCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new Error("Category not found");

  const expense = await prisma.expense.create({
    data: {
      categoryId,
      amount: new Decimal(amount.toString()),
      date,
      paymentMethod,
      status: (status as "PAID" | "UNPAID") || "PAID",
      description: description || null,
      attachmentUrl: attachmentUrl || null,
      createdById: session.user.id,
    },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "created",
      affectedType: "Expense",
      affectedId: expense.id,
      newValue: {
        amount: expense.amount.toString(),
        categoryId: expense.categoryId,
        paymentMethod: expense.paymentMethod,
        status: expense.status,
      },
    },
  });

  revalidatePath("/expenses");
  return expense;
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
      paymentMethod,
      status: (status as "PAID" | "UNPAID") || "PAID",
      description: description || null,
      attachmentUrl: attachmentUrl || null,
    },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "updated",
      affectedType: "Expense",
      affectedId: id,
      previousValue: {
        categoryId: existing.categoryId,
        amount: existing.amount.toString(),
        paymentMethod: existing.paymentMethod,
        status: existing.status,
      },
      newValue: {
        categoryId: updated.categoryId,
        amount: updated.amount.toString(),
        paymentMethod: updated.paymentMethod,
        status: updated.status,
      },
    },
  });

  revalidatePath("/expenses");
  return updated;
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Only Owner can delete
  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can delete expenses");
  }

  const expense = await prisma.expense.findUnique({
    where: { id },
  });
  if (!expense) throw new Error("Expense not found");

  // Create audit log before deletion
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "deleted",
      affectedType: "Expense",
      affectedId: id,
      previousValue: {
        amount: expense.amount.toString(),
        categoryId: expense.categoryId,
        paymentMethod: expense.paymentMethod,
        status: expense.status,
      },
    },
  });

  await prisma.expense.delete({
    where: { id },
  });

  revalidatePath("/expenses");
}

export async function createExpenseCategory(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Only Owner can create categories
  if (session.user.role !== "OWNER") {
    throw new Error("Only Owner can create expense categories");
  }

  const category = await prisma.expenseCategory.create({
    data: { name },
  });

  revalidatePath("/expenses");
  return category;
}

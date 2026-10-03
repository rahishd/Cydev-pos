import { NextRequest, NextResponse } from "next/server";
import type { ExpenseStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { verifyExpenseReportToken, type ExpenseReportFilters } from "@/lib/invoice-link";
import { buildExpenseReportPdf } from "@/lib/expense-pdf";

export const dynamic = "force-dynamic";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const f: ExpenseReportFilters = {
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    category: sp.get("category") ?? "",
    method: sp.get("method") ?? "",
    status: sp.get("status") ?? "",
    q: sp.get("q") ?? "",
  };
  const token = sp.get("t") ?? "";
  if (!token || !verifyExpenseReportToken(f, token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const where: Prisma.ExpenseWhereInput = {};
  if (f.category) where.categoryId = f.category;
  if (f.method) where.paymentMethod = f.method as PaymentMethod;
  if (f.status) where.status = f.status as ExpenseStatus;
  if (f.from || f.to) {
    where.date = {};
    if (f.from) where.date.gte = new Date(f.from);
    if (f.to) where.date.lt = new Date(new Date(f.to).getTime() + 86400000);
  }
  if (f.q) {
    where.OR = [
      { id: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.expense.findMany({
    where,
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      amount: true,
      paymentMethod: true,
      status: true,
      description: true,
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  const filters: string[] = [];
  if (f.category) filters.push(`Category: ${rows[0]?.category.name ?? "selected"}`);
  if (f.method) filters.push(`Method: ${f.method.replace(/_/g, " ")}`);
  if (f.status) filters.push(`Status: ${f.status}`);
  if (f.q) filters.push(`Search: "${f.q}"`);

  await getSettings();
  const doc = buildExpenseReportPdf({
    periodLabel:
      f.from || f.to
        ? `${f.from ? fmt(f.from) : "Start"} - ${f.to ? fmt(f.to) : "Today"}`
        : "All dates",
    filterLabel: filters.join("  |  ") || undefined,
    expenses: rows.map((e) => ({
      id: e.id,
      date: e.date,
      categoryName: e.category.name,
      description: e.description,
      amount: Number(e.amount),
      paymentMethod: e.paymentMethod,
      status: e.status,
      createdByName: e.createdBy.name,
    })),
  });

  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Expense-Report.pdf"',
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}

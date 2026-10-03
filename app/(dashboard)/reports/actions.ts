"use server";

import { getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { canOpenReport, reportDef } from "@/lib/reports/catalog";
import { isValidDay, nepalToday, periodLabel, daysBetween } from "@/lib/reports/range";
import type { Filters, ReportResult } from "@/lib/reports/types";
import type { Body, Ctx } from "@/lib/reports/build-sales";
import * as S from "@/lib/reports/build-sales";
import * as O from "@/lib/reports/build-other";

type Builder = (f: Filters, ctx: Ctx) => Promise<Body>;

const BUILDERS: Record<string, Builder> = {
  overview: O.overview,
  "sales.summary": S.salesSummary,
  "sales.product": S.salesByProduct,
  "sales.category": S.salesByCategory,
  "sales.brand": S.salesByBrand,
  "sales.staff": S.salesByStaff,
  "profit.summary": S.profitSummary,
  "profit.product": S.profitByProduct,
  "profit.category": S.profitByCategory,
  "profit.brand": S.profitByBrand,
  "profit.date": S.profitByDate,
  "inventory.current": O.inventoryCurrent,
  "inventory.valuation": O.inventoryValuation,
  "inventory.movement": O.inventoryMovement,
  "inventory.low": O.inventoryLow,
  "inventory.out": O.inventoryOut,
  "inventory.adjustments": O.inventoryAdjustments,
  "products.fast": O.productsFast,
  "products.slow": O.productsSlow,
  "purchases.summary": O.purchasesSummary,
  "purchases.product": O.purchasesByProduct,
  "purchases.supplier": O.purchasesBySupplier,
  "suppliers.statement": O.suppliersStatement,
  "customers.summary": O.customersSummary,
  "customers.top": O.customersTop,
  "customers.credit": O.customersCredit,
  payments: S.paymentsReport,
  expenses: O.expensesReport,
  returns: S.returnsReport,
  discounts: S.discountsReport,
  "staff.activity": O.staffActivity,
  "closing.daily": O.dailyClosing,
};

const clean = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : undefined);

export async function runReport(key: string, input: Filters): Promise<ReportResult> {
  const access = await getAccess();
  if (!access) throw new Error("Please sign in again.");
  const def = reportDef(key);
  const build = BUILDERS[key];
  if (!def || !build) throw new Error("That report doesn't exist.");
  if (!canOpenReport(def, access.can)) throw new Error("You don't have permission to view this report.");

  const today = nepalToday();
  const from = isValidDay(input.from) ? input.from : today;
  const to = isValidDay(input.to) ? input.to : today;
  const filters: Filters = {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    categoryId: clean(input.categoryId),
    brandId: clean(input.brandId),
    staffId: clean(input.staffId),
    customerId: clean(input.customerId),
    supplierId: clean(input.supplierId),
    method: clean(input.method),
  };
  if (daysBetween(filters.from, filters.to) > 800) throw new Error("Please choose a range shorter than about two years.");

  const body = await build(filters, { can: access.can });
  return {
    key,
    title: def.label,
    periodLabel: def.asOf ? "As of now" : periodLabel(filters.from, filters.to),
    notes: body.notes ?? [],
    cards: body.cards ?? [],
    charts: body.charts ?? [],
    tables: body.tables ?? [],
    cashRecon: body.cashRecon,
  };
}

/** Names for the filter drop-downs. */
export async function getReportFilterOptions() {
  const access = await getAccess();
  const overview = reportDef("overview");
  if (!access || !overview || !canOpenReport(overview, access.can)) throw new Error("You don't have permission to view reports.");
  const [categories, brands, staff, customers, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, take: 300, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, brands, staff, customers, suppliers };
}

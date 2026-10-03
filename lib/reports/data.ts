import { prisma } from "@/lib/prisma";
import { nepalDay, toInstants } from "@/lib/reports/range";
import type { Filters, Row } from "@/lib/reports/types";

export const num = (d: unknown) => Number(d ?? 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

export const DIGITAL = ["ESEWA", "KHALTI", "FONEPAY", "CARD", "BANK_TRANSFER"];

export const methodLabel = (m: string) =>
  ({ CASH: "Cash", ESEWA: "eSewa", KHALTI: "Khalti", FONEPAY: "Fonepay", CARD: "Card", BANK_TRANSFER: "Bank Transfer", CREDIT: "Customer Credit", OTHER: "Other" })[m] ??
  m;

export type Line = {
  saleId: string;
  invoiceNo: string;
  at: Date;
  day: string;
  staffId: string;
  staffName: string;
  customerId: string | null;
  customerName: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  categoryId: string | null;
  category: string;
  brandId: string | null;
  brand: string;
  qty: number;
  gross: number;
  lineDisc: number;
  orderDisc: number;
  /** Sales value after every discount, before tax. */
  net: number;
  cost: number;
  profit: number;
};

export type SaleRow = {
  id: string;
  invoiceNo: string;
  at: Date;
  day: string;
  staffId: string;
  staffName: string;
  customerName: string;
  discount: number;
  promoCode: string | null;
  promoDiscount: number;
  tax: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
};

export type Loaded = { lines: Line[]; sales: SaleRow[]; start: Date; end: Date };

const variantName = (name: string, size: string | null, color: string | null) =>
  [name, [size, color].filter(Boolean).join(" / ")].filter(Boolean).join(" - ");

/** Completed (not cancelled) sales in the period, flattened to one line per item. Order-level discounts are shared across the lines by value. */
export async function loadSales(f: Filters): Promise<Loaded> {
  const { start, end } = toInstants(f.from, f.to);
  const rows = await prisma.sale.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { not: "CANCELLED" },
      ...(f.staffId ? { staffId: f.staffId } : {}),
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(f.method ? { payments: { some: { method: f.method as never } } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      invoiceNo: true,
      createdAt: true,
      discount: true,
      promoCode: true,
      promoDiscount: true,
      tax: true,
      total: true,
      staffId: true,
      staff: { select: { name: true } },
      customer: { select: { id: true, name: true } },
      payments: { select: { method: true, amount: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          unitCost: true,
          discount: true,
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                  brand: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const lines: Line[] = [];
  const sales: SaleRow[] = [];
  for (const s of rows) {
    const bases = s.items.map((i) => num(i.unitPrice) * i.quantity - num(i.discount));
    const baseSum = bases.reduce((a, b) => a + b, 0);
    const orderDisc = num(s.discount);
    let kept = 0;
    s.items.forEach((i, idx) => {
      const p = i.productVariant.product;
      if (f.categoryId && p.category?.id !== f.categoryId) return;
      if (f.brandId && p.brand?.id !== f.brandId) return;
      kept++;
      const gross = num(i.unitPrice) * i.quantity;
      const lineDisc = num(i.discount);
      const share = baseSum > 0 ? (orderDisc * bases[idx]) / baseSum : 0;
      const net = gross - lineDisc - share;
      const cost = num(i.unitCost) * i.quantity;
      lines.push({
        saleId: s.id,
        invoiceNo: s.invoiceNo,
        at: s.createdAt,
        day: nepalDay(s.createdAt),
        staffId: s.staffId,
        staffName: s.staff.name,
        customerId: s.customer?.id ?? null,
        customerName: s.customer?.name ?? "Walk-in",
        productId: p.id,
        variantId: i.productVariant.id,
        productName: variantName(p.name, i.productVariant.size, i.productVariant.color),
        sku: i.productVariant.sku,
        categoryId: p.category?.id ?? null,
        category: p.category?.name ?? "Uncategorised",
        brandId: p.brand?.id ?? null,
        brand: p.brand?.name ?? "No brand",
        qty: i.quantity,
        gross,
        lineDisc,
        orderDisc: share,
        net,
        cost,
        profit: net - cost,
      });
    });
    if (kept > 0 || (!f.categoryId && !f.brandId)) {
      sales.push({
        id: s.id,
        invoiceNo: s.invoiceNo,
        at: s.createdAt,
        day: nepalDay(s.createdAt),
        staffId: s.staffId,
        staffName: s.staff.name,
        customerName: s.customer?.name ?? "Walk-in",
        discount: orderDisc,
        promoCode: s.promoCode,
        promoDiscount: num(s.promoDiscount),
        tax: num(s.tax),
        total: num(s.total),
        payments: s.payments.map((p) => ({ method: p.method, amount: num(p.amount) })),
      });
    }
  }
  return { lines, sales, start, end };
}

export type Totals = {
  gross: number;
  discounts: number;
  net: number;
  cost: number;
  profit: number;
  qty: number;
  invoices: number;
};

export function totalsOf(lines: Line[]): Totals {
  const t = { gross: 0, discounts: 0, net: 0, cost: 0, profit: 0, qty: 0, invoices: 0 };
  const ids = new Set<string>();
  for (const l of lines) {
    t.gross += l.gross;
    t.discounts += l.lineDisc + l.orderDisc;
    t.net += l.net;
    t.cost += l.cost;
    t.profit += l.profit;
    t.qty += l.qty;
    ids.add(l.saleId);
  }
  t.invoices = ids.size;
  return t;
}

/** Sum a set of lines by some key, returning one entry per key in descending net order. */
export function groupLines<K extends string>(lines: Line[], keyOf: (l: Line) => K, labelOf: (l: Line) => string = (l) => keyOf(l)) {
  const map = new Map<K, { key: K; label: string; first: Line; lines: Line[] }>();
  for (const l of lines) {
    const k = keyOf(l);
    const e = map.get(k);
    if (e) e.lines.push(l);
    else map.set(k, { key: k, label: labelOf(l), first: l, lines: [l] });
  }
  return [...map.values()]
    .map((g) => ({ ...g, t: totalsOf(g.lines) }))
    .sort((a, b) => b.t.net - a.t.net);
}

export async function loadReturns(f: Filters) {
  const { start, end } = toInstants(f.from, f.to);
  const rows = await prisma.saleReturn.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      sale: {
        ...(f.staffId ? { staffId: f.staffId } : {}),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      quantity: true,
      reason: true,
      refundAmount: true,
      returnedCost: true,
      refunded: true,
      priceDifference: true,
      storeCredit: true,
      createdAt: true,
      sale: { select: { invoiceNo: true, staff: { select: { name: true } }, customer: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as "RETURN" | "EXCHANGE",
    qty: r.quantity,
    reason: r.reason?.trim() || "Not given",
    amount: num(r.refundAmount),
    cost: num(r.returnedCost),
    refunded: r.refunded,
    priceDifference: r.priceDifference === null ? null : num(r.priceDifference),
    storeCredit: r.storeCredit,
    at: r.createdAt,
    invoiceNo: r.sale.invoiceNo,
    staff: r.sale.staff.name,
    customer: r.sale.customer?.name ?? "Walk-in",
  }));
}

export async function loadExpenses(f: Filters) {
  const { start, end } = toInstants(f.from, f.to);
  const rows = await prisma.expense.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(f.staffId ? { createdById: f.staffId } : {}),
      ...(f.method ? { paymentMethod: f.method as never } : {}),
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      amount: true,
      date: true,
      paymentMethod: true,
      status: true,
      description: true,
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    amount: num(e.amount),
    at: e.date,
    day: nepalDay(e.date),
    method: e.paymentMethod as string,
    status: e.status as string,
    description: e.description ?? "",
    category: e.category.name,
    by: e.createdBy.name,
  }));
}

export const sumBy = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

export function totalsRow(label: string, rows: Row[], keys: string[], labelKey: string): Row {
  const out: Row = { [labelKey]: label };
  for (const k of keys) out[k] = round2(rows.reduce((a, r) => a + Number(r[k] ?? 0), 0));
  return out;
}

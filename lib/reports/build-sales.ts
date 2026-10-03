import {
  DIGITAL,
  groupLines,
  loadExpenses,
  loadReturns,
  loadSales,
  methodLabel,
  num,
  pct,
  round2,
  sumBy,
  totalsOf,
  totalsRow,
} from "@/lib/reports/data";
import { daysBetween, eachDay } from "@/lib/reports/range";
import type { Card, ChartSpec, Col, Filters, ReportResult, Row } from "@/lib/reports/types";
import { prisma } from "@/lib/prisma";
import { toInstants } from "@/lib/reports/range";

export type Ctx = { can: (permission: string) => boolean };
export type Body = Partial<Pick<ReportResult, "cards" | "charts" | "tables" | "notes" | "cashRecon">>;

const RETURN_NOTE =
  "Returns come from the refund amounts recorded on the Returns & Exchanges screen. They are not tied to individual products, so product and category tables don't subtract them.";

/** Day-by-day points, or month-by-month when the range is long, so charts stay readable. */
export function bucketKey(day: string, from: string, to: string): string {
  if (daysBetween(from, to) <= 62) return day;
  return day.slice(0, 7);
}

export function bucketLabel(key: string): string {
  const d = new Date(key.length === 7 ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return key.length === 7
    ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function bucketKeys(from: string, to: string): string[] {
  return [...new Set(eachDay(from, to).map((d) => bucketKey(d, from, to)))];
}

const money = (key: string, label: string): Col => ({ key, label, fmt: "money" });
const int = (key: string, label: string): Col => ({ key, label, fmt: "int" });
const pctCol = (key: string, label: string): Col => ({ key, label, fmt: "pct" });
const text = (key: string, label: string): Col => ({ key, label, fmt: "text" });

const paidBy = (sales: Awaited<ReturnType<typeof loadSales>>["sales"]) => {
  const by: Record<string, { count: number; amount: number }> = {};
  for (const s of sales) {
    for (const p of s.payments) {
      const e = (by[p.method] ??= { count: 0, amount: 0 });
      e.count++;
      e.amount += p.amount;
    }
  }
  return by;
};

export async function salesSummary(f: Filters, ctx: Ctx): Promise<Body> {
  const [{ lines, sales }, returns] = await Promise.all([loadSales(f), loadReturns(f)]);
  const t = totalsOf(lines);
  const refunds = sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.amount);
  const by = paidBy(sales);
  const digital = sumBy(DIGITAL, (m) => by[m]?.amount ?? 0);
  const net = t.gross - t.discounts - refunds;

  const cards: Card[] = [
    { label: "Gross Sales", value: round2(t.gross), fmt: "money" },
    { label: "Discounts", value: round2(t.discounts), fmt: "money" },
    { label: "Returns", value: round2(refunds), fmt: "money" },
    { label: "Net Sales", value: round2(net), fmt: "money", tone: "good" },
    { label: "Invoices", value: t.invoices, fmt: "int" },
    { label: "Items Sold", value: t.qty, fmt: "int" },
    { label: "Average Order Value", value: t.invoices ? round2((t.gross - t.discounts) / t.invoices) : 0, fmt: "money" },
    { label: "Cash Sales", value: round2(by.CASH?.amount ?? 0), fmt: "money" },
    { label: "Digital Payments", value: round2(digital), fmt: "money" },
    { label: "Credit Sales", value: round2(by.CREDIT?.amount ?? 0), fmt: "money" },
  ];

  const keys = bucketKeys(f.from, f.to);
  const days = new Map(keys.map((k) => [k, { invoices: new Set<string>(), qty: 0, gross: 0, disc: 0, net: 0 }]));
  for (const l of lines) {
    const e = days.get(bucketKey(l.day, f.from, f.to))!;
    e.invoices.add(l.saleId);
    e.qty += l.qty;
    e.gross += l.gross;
    e.disc += l.lineDisc + l.orderDisc;
    e.net += l.net;
  }
  const rows: Row[] = keys.map((k) => {
    const e = days.get(k)!;
    return { period: bucketLabel(k), invoices: e.invoices.size, qty: e.qty, gross: round2(e.gross), disc: round2(e.disc), net: round2(e.net) };
  });

  const charts: ChartSpec[] = [
    { kind: "line", title: "Sales trend", money: true, data: rows.map((r) => ({ name: String(r.period), net: Number(r.net) })), series: [{ key: "net", label: "Net sales" }] },
  ];

  return {
    cards,
    charts,
    notes: [RETURN_NOTE, ...(f.categoryId || f.brandId ? ["Payment figures show whole invoices that include a matching product."] : [])],
    tables: [
      {
        title: "Sales by period",
        cols: [text("period", "Period"), int("invoices", "Invoices"), int("qty", "Items"), money("gross", "Gross Sales"), money("disc", "Discounts"), money("net", "Net Sales")],
        rows,
        totals: totalsRow("Total", rows, ["invoices", "qty", "gross", "disc", "net"], "period"),
      },
    ],
  };
}

export async function salesByProduct(f: Filters, ctx: Ctx): Promise<Body> {
  const { lines } = await loadSales(f);
  const profit = ctx.can("reports.gross_profit");
  const groups = groupLines(lines, (l) => l.variantId, (l) => l.productName);
  const rows: Row[] = groups.map((g) => ({
    product: g.label,
    sku: g.first.sku,
    category: g.first.category,
    qty: g.t.qty,
    gross: round2(g.t.gross),
    disc: round2(g.t.discounts),
    net: round2(g.t.net),
    cost: round2(g.t.cost),
    profit: round2(g.t.profit),
  }));
  const cols: Col[] = [text("product", "Product"), text("sku", "SKU"), text("category", "Category"), int("qty", "Qty Sold"), money("gross", "Gross Sales"), money("disc", "Discount"), money("net", "Net Sales")];
  const sums = ["qty", "gross", "disc", "net"];
  if (profit) {
    cols.push(money("cost", "Cost"), money("profit", "Gross Profit"));
    sums.push("cost", "profit");
  }
  return {
    notes: [RETURN_NOTE],
    charts: [
      { kind: "hbar", title: "Top products by net sales", money: true, data: rows.slice(0, 8).map((r) => ({ name: String(r.product), net: Number(r.net) })), series: [{ key: "net", label: "Net sales" }] },
    ],
    tables: [{ cols, rows, totals: totalsRow("Total", rows, sums, "product") }],
  };
}

async function salesByGroup(f: Filters, ctx: Ctx, by: "category" | "brand"): Promise<Body> {
  const { lines } = await loadSales(f);
  const profit = ctx.can("reports.gross_profit");
  const groups = groupLines(lines, (l) => (by === "category" ? l.category : l.brand));
  const rows: Row[] = groups.map((g) => ({
    name: g.label,
    qty: g.t.qty,
    net: round2(g.t.net),
    profit: round2(g.t.profit),
    margin: pct(g.t.profit, g.t.net),
  }));
  const label = by === "category" ? "Category" : "Brand";
  const cols: Col[] = [text("name", label), int("qty", "Qty Sold"), money("net", "Sales")];
  const sums = ["qty", "net"];
  if (profit) {
    cols.push(money("profit", "Profit"), pctCol("margin", "Profit Margin"));
    sums.push("profit");
  }
  const totals = totalsRow("Total", rows, sums, "name");
  if (profit) totals.margin = pct(Number(totals.profit), Number(totals.net));
  return {
    charts: [{ kind: "donut", title: `Sales by ${label.toLowerCase()}`, money: true, data: rows.map((r) => ({ name: String(r.name), net: Number(r.net) })), series: [{ key: "net", label: "Sales" }] }],
    tables: [{ cols, rows, totals }],
  };
}
export const salesByCategory = (f: Filters, c: Ctx) => salesByGroup(f, c, "category");
export const salesByBrand = (f: Filters, c: Ctx) => salesByGroup(f, c, "brand");

export async function salesByStaff(f: Filters, ctx: Ctx): Promise<Body> {
  const [{ lines }, returns] = await Promise.all([loadSales(f), loadReturns({ ...f, staffId: undefined })]);
  const groups = groupLines(lines, (l) => l.staffId, (l) => l.staffName);
  const retBy = new Map<string, number>();
  for (const r of returns.filter((x) => x.type === "RETURN")) retBy.set(r.staff, (retBy.get(r.staff) ?? 0) + 1);
  const rows: Row[] = groups.map((g) => ({
    staff: g.label,
    sales: g.t.invoices,
    qty: g.t.qty,
    net: round2(g.t.net),
    disc: round2(g.t.discounts),
    returns: retBy.get(g.label) ?? 0,
  }));
  return {
    notes: ["Returns are counted against the staff member who made the original sale."],
    charts: [{ kind: "hbar", title: "Net sales by staff", money: true, data: rows.map((r) => ({ name: String(r.staff), net: Number(r.net) })), series: [{ key: "net", label: "Net sales" }] }],
    tables: [
      {
        cols: [text("staff", "Staff"), int("sales", "Number of Sales"), int("qty", "Items Sold"), money("net", "Sales Amount"), money("disc", "Discounts Given"), int("returns", "Returns on Their Sales")],
        rows,
        totals: totalsRow("Total", rows, ["sales", "qty", "net", "disc", "returns"], "staff"),
      },
    ],
  };
}

async function periodExpenses(f: Filters) {
  const list = await loadExpenses({ ...f, method: undefined, staffId: undefined });
  return list;
}

export async function profitSummary(f: Filters, ctx: Ctx): Promise<Body> {
  const [{ lines }, returns, expenses] = await Promise.all([loadSales(f), loadReturns(f), periodExpenses(f)]);
  const t = totalsOf(lines);
  const refunds = sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.amount);
  const net = t.gross - t.discounts - refunds;
  // Goods that came back into stock are no longer a cost of sales.
  const cogs = t.cost - sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.cost);
  const gp = net - cogs;
  const exp = sumBy(expenses, (e) => e.amount);
  const showNet = ctx.can("reports.net_profit");
  const np = gp - exp;

  const cards: Card[] = [
    { label: "Net Sales", value: round2(net), fmt: "money" },
    { label: "Cost of Goods Sold", value: round2(cogs), fmt: "money" },
    { label: "Gross Profit", value: round2(gp), fmt: "money", tone: gp >= 0 ? "good" : "bad" },
    { label: "Gross Margin", value: pct(gp, net), fmt: "pct" },
  ];
  if (showNet) {
    cards.push(
      { label: "Operating Expenses", value: round2(exp), fmt: "money" },
      { label: "Net Profit", value: round2(np), fmt: "money", tone: np >= 0 ? "good" : "bad" },
      { label: "Net Profit Margin", value: pct(np, net), fmt: "pct" }
    );
  }

  const flow: Row[] = [
    { item: "Sales revenue", amount: round2(t.gross) },
    { item: "less Discounts", amount: -round2(t.discounts) },
    { item: "less Returns", amount: -round2(refunds) },
    { item: "Net sales", amount: round2(net) },
    { item: "less Cost of goods sold", amount: -round2(cogs) },
    { item: "Gross profit", amount: round2(gp) },
  ];
  if (showNet) {
    flow.push({ item: "less Operating expenses", amount: -round2(exp) }, { item: "Net profit", amount: round2(np) });
  }

  return {
    cards,
    notes: [
      "Cost of goods sold uses the actual purchase cost recorded on each sale, not today's price.",
      "Returns are deducted at the amount refunded to the customer, and the cost of goods that went back into stock is taken off the cost of goods sold."
    ],
    tables: [{ title: "How profit is worked out", cols: [text("item", "Line"), money("amount", "Amount")], rows: flow }],
  };
}

async function profitByGroup(f: Filters, by: "product" | "category" | "brand"): Promise<Body> {
  const { lines } = await loadSales(f);
  const groups =
    by === "product"
      ? groupLines(lines, (l) => l.variantId, (l) => l.productName)
      : groupLines(lines, (l) => (by === "category" ? l.category : l.brand));
  const rows: Row[] = groups
    .map((g) => ({
      name: g.label,
      sales: round2(g.t.net),
      cost: round2(g.t.cost),
      profit: round2(g.t.profit),
      margin: pct(g.t.profit, g.t.net),
    }))
    .sort((a, b) => b.profit - a.profit);
  const totals = totalsRow("Total", rows, ["sales", "cost", "profit"], "name");
  totals.margin = pct(Number(totals.profit), Number(totals.sales));
  const label = by === "product" ? "Product" : by === "category" ? "Category" : "Brand";
  return {
    charts: [{ kind: "hbar", title: `Gross profit by ${label.toLowerCase()}`, money: true, data: rows.slice(0, 8).map((r) => ({ name: String(r.name), profit: Number(r.profit) })), series: [{ key: "profit", label: "Gross profit" }] }],
    tables: [{ cols: [text("name", label), money("sales", "Sales"), money("cost", "Cost"), money("profit", "Gross Profit"), pctCol("margin", "Margin")], rows, totals }],
  };
}
export const profitByProduct = (f: Filters, _c: Ctx) => profitByGroup(f, "product");
export const profitByCategory = (f: Filters, _c: Ctx) => profitByGroup(f, "category");
export const profitByBrand = (f: Filters, _c: Ctx) => profitByGroup(f, "brand");

export async function profitByDate(f: Filters, ctx: Ctx): Promise<Body> {
  const [{ lines }, expenses] = await Promise.all([loadSales(f), periodExpenses(f)]);
  const showNet = ctx.can("reports.net_profit");
  const keys = bucketKeys(f.from, f.to);
  const m = new Map(keys.map((k) => [k, { sales: 0, cost: 0, exp: 0 }]));
  for (const l of lines) {
    const e = m.get(bucketKey(l.day, f.from, f.to))!;
    e.sales += l.net;
    e.cost += l.cost;
  }
  for (const x of expenses) {
    const e = m.get(bucketKey(x.day, f.from, f.to));
    if (e) e.exp += x.amount;
  }
  const rows: Row[] = keys.map((k) => {
    const e = m.get(k)!;
    const gp = e.sales - e.cost;
    return { period: bucketLabel(k), sales: round2(e.sales), cost: round2(e.cost), gp: round2(gp), exp: round2(e.exp), np: round2(gp - e.exp) };
  });
  const cols: Col[] = [text("period", "Period"), money("sales", "Sales"), money("cost", "Cost"), money("gp", "Gross Profit")];
  const sums = ["sales", "cost", "gp"];
  if (showNet) {
    cols.push(money("exp", "Expenses"), money("np", "Net Profit"));
    sums.push("exp", "np");
  }
  const series = [{ key: "gp", label: "Gross profit" }, ...(showNet ? [{ key: "np", label: "Net profit" }] : [])];
  return {
    charts: [{ kind: "line", title: "Profit trend", money: true, data: rows.map((r) => ({ name: String(r.period), gp: Number(r.gp), np: Number(r.np) })), series }],
    tables: [{ cols, rows, totals: totalsRow("Total", rows, sums, "period") }],
  };
}

export async function paymentsReport(f: Filters, _ctx: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const [{ sales }, returns, cancelled] = await Promise.all([
    loadSales({ ...f, method: undefined }),
    loadReturns(f),
    prisma.sale.aggregate({
      where: { status: "CANCELLED", createdAt: { gte: start, lt: end }, ...(f.staffId ? { staffId: f.staffId } : {}), ...(f.customerId ? { customerId: f.customerId } : {}) },
      _count: { id: true },
      _sum: { total: true },
    }),
  ]);
  const by = paidBy(sales);
  const total = sumBy(Object.values(by), (e) => e.amount);
  const rows: Row[] = Object.entries(by)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([m, e]) => ({ method: methodLabel(m), tx: e.count, amount: round2(e.amount), share: pct(e.amount, total) }));
  const refunds = sumBy(returns.filter((r) => r.type === "RETURN" && !r.storeCredit), (r) => r.amount);
  const credit = by.CREDIT?.amount ?? 0;
  const cards: Card[] = [
    { label: "Total Payments", value: round2(total), fmt: "money" },
    { label: "Cash", value: round2(by.CASH?.amount ?? 0), fmt: "money" },
    { label: "Digital", value: round2(sumBy(DIGITAL, (m) => by[m]?.amount ?? 0)), fmt: "money" },
    { label: "Credit Sales", value: round2(credit), fmt: "money" },
    { label: "Refunds", value: round2(refunds), fmt: "money" },
    { label: "Cancelled Sales", value: cancelled._count.id, fmt: "int", hint: `NPR ${round2(num(cancelled._sum.total)).toLocaleString("en-US")}` },
  ];
  return {
    cards,
    notes: ["Failed or abandoned QR payment attempts aren't stored as payments, so they are not listed here."],
    charts: [{ kind: "donut", title: "Payment method distribution", money: true, data: rows.map((r) => ({ name: String(r.method), amount: Number(r.amount) })), series: [{ key: "amount", label: "Amount" }] }],
    tables: [{ cols: [text("method", "Payment Method"), int("tx", "Transactions"), money("amount", "Amount"), pctCol("share", "Share")], rows, totals: totalsRow("Total", rows, ["tx", "amount"], "method") }],
  };
}

export async function discountsReport(f: Filters, _ctx: Ctx): Promise<Body> {
  const { lines } = await loadSales(f);
  const t = totalsOf(lines);
  const lineDisc = sumBy(lines, (l) => l.lineDisc);
  const orderDisc = sumBy(lines, (l) => l.orderDisc);
  const bySale = groupLines(lines, (l) => l.saleId, (l) => l.invoiceNo).filter((g) => g.t.discounts > 0.005);
  const discounted = bySale.length;

  const staff = groupLines(lines, (l) => l.staffId, (l) => l.staffName).map((g) => ({
    staff: g.label,
    sales: g.t.invoices,
    discounted: new Set(g.lines.filter((l) => l.lineDisc + l.orderDisc > 0.005).map((l) => l.saleId)).size,
    disc: round2(g.t.discounts),
    share: pct(g.t.discounts, g.t.gross),
  })) as Row[];
  const product = groupLines(lines, (l) => l.variantId, (l) => l.productName)
    .map((g) => ({ product: g.label, qty: g.t.qty, disc: round2(g.t.discounts), share: pct(g.t.discounts, g.t.gross) }))
    .filter((r) => r.disc > 0.005)
    .sort((a, b) => b.disc - a.disc)
    .slice(0, 25) as Row[];
  const invoice = bySale
    .map((g) => ({ invoice: g.label, date: g.first.at.toISOString(), staff: g.first.staffName, customer: g.first.customerName, gross: round2(g.t.gross), disc: round2(g.t.discounts), share: pct(g.t.discounts, g.t.gross) }))
    .sort((a, b) => b.disc - a.disc)
    .slice(0, 50) as Row[];

  return {
    cards: [
      { label: "Total Discounts", value: round2(t.discounts), fmt: "money" },
      { label: "Discounted Sales", value: discounted, fmt: "int" },
      { label: "Average Discount", value: discounted ? round2(t.discounts / discounted) : 0, fmt: "money" },
      { label: "Discount as % of Sales", value: pct(t.discounts, t.gross), fmt: "pct" },
      { label: "Item-level Discounts", value: round2(lineDisc), fmt: "money" },
      { label: "Whole-bill Discounts", value: round2(orderDisc), fmt: "money" },
    ],
    notes: ["Manual and promotional discounts aren't recorded separately, so they are shown as item-level and whole-bill discounts."],
    tables: [
      { title: "By staff", cols: [text("staff", "Staff"), int("sales", "Sales"), int("discounted", "Discounted Sales"), money("disc", "Discount Given"), pctCol("share", "% of Sales")], rows: staff, totals: totalsRow("Total", staff, ["sales", "discounted", "disc"], "staff") },
      { title: "By product (top 25)", cols: [text("product", "Product"), int("qty", "Qty"), money("disc", "Discount"), pctCol("share", "% of Sales")], rows: product },
      { title: "By invoice (top 50)", cols: [text("invoice", "Invoice"), { key: "date", label: "Date", fmt: "date" }, text("staff", "Staff"), text("customer", "Customer"), money("gross", "Gross"), money("disc", "Discount"), pctCol("share", "%")], rows: invoice },
    ],
  };
}

export async function returnsReport(f: Filters, _ctx: Ctx): Promise<Body> {
  const returns = await loadReturns(f);
  const rets = returns.filter((r) => r.type === "RETURN");
  const exch = returns.filter((r) => r.type === "EXCHANGE");
  const byReason = new Map<string, { n: number; qty: number; amount: number }>();
  for (const r of rets) {
    const e = byReason.get(r.reason) ?? { n: 0, qty: 0, amount: 0 };
    e.n++;
    e.qty += r.qty;
    e.amount += r.amount;
    byReason.set(r.reason, e);
  }
  const reasonRows: Row[] = [...byReason.entries()].sort((a, b) => b[1].n - a[1].n).map(([reason, e]) => ({ reason, n: e.n, qty: e.qty, amount: round2(e.amount) }));
  const rows: Row[] = returns.map((r) => ({
    _id: r.id,
    _tone: r.refunded ? "good" : "bad",
    status: r.refunded ? (r.storeCredit ? "Credit issued" : "Refunded") : "Not refunded",
    date: r.at.toISOString(),
    invoice: r.invoiceNo,
    type: r.type === "RETURN" ? "Return" : "Exchange",
    customer: r.customer,
    staff: r.staff,
    qty: r.qty,
    reason: r.reason,
    amount: round2(r.amount),
    refundedAs: r.storeCredit ? "Store credit" : "Cash / original method",
  }));
  return {
    cards: [
      { label: "Returns", value: rets.length, fmt: "int" },
      { label: "Returned Quantity", value: sumBy(rets, (r) => r.qty), fmt: "int" },
      { label: "Return / Refund Value", value: round2(sumBy(rets, (r) => r.amount)), fmt: "money" },
      { label: "Exchanges", value: exch.length, fmt: "int" },
      { label: "Exchange Quantity", value: sumBy(exch, (r) => r.qty), fmt: "int" },
      { label: "Exchange Value", value: round2(sumBy(exch, (r) => r.amount)), fmt: "money" },
    ],
    notes: ["Returns aren't linked to a product, so they can't be split by product or category. Use the date, staff and customer filters instead."],
    tables: [
      { title: "By reason", cols: [text("reason", "Reason"), int("n", "Returns"), int("qty", "Quantity"), money("amount", "Value")], rows: reasonRows },
      { title: "All returns & exchanges", rowActions: "return" as const, cols: [text("status", "Refund"), { key: "date", label: "Date", fmt: "date" }, text("invoice", "Invoice"), text("type", "Type"), text("customer", "Customer"), text("staff", "Sold By"), int("qty", "Qty"), text("reason", "Reason"), money("amount", "Value"), text("refundedAs", "Refunded As")], rows },
    ],
  };
}

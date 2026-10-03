import { prisma } from "@/lib/prisma";
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
import { daysBetween, nepalDay, toInstants } from "@/lib/reports/range";
import { bucketKey, bucketKeys, bucketLabel, type Body, type Ctx } from "@/lib/reports/build-sales";
import type { Card, ChartSpec, Col, Filters, Row } from "@/lib/reports/types";

const money = (key: string, label: string): Col => ({ key, label, fmt: "money" });
const int = (key: string, label: string): Col => ({ key, label, fmt: "int" });
const pctCol = (key: string, label: string): Col => ({ key, label, fmt: "pct" });
const text = (key: string, label: string): Col => ({ key, label, fmt: "text" });
const date = (key: string, label: string): Col => ({ key, label, fmt: "date" });

// ---------------------------------------------------------------- inventory

async function loadVariants(f: Filters) {
  const rows = await prisma.productVariant.findMany({
    where: {
      status: "ACTIVE",
      product: {
        status: "ACTIVE",
        ...(f.categoryId ? { categoryId: f.categoryId } : {}),
        ...(f.brandId ? { brandId: f.brandId } : {}),
        ...(f.supplierId ? { supplierId: f.supplierId } : {}),
      },
    },
    orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      quantity: true,
      minStockLevel: true,
      purchasePrice: true,
      sellingPrice: true,
      product: { select: { id: true, name: true, minStockLevel: true, category: { select: { name: true } }, brand: { select: { name: true } } } },
    },
  });
  return rows.map((v) => {
    const min = v.minStockLevel > 0 ? v.minStockLevel : v.product.minStockLevel;
    const detail = [v.size, v.color].filter(Boolean).join(" / ");
    return {
      id: v.id,
      productId: v.product.id,
      name: v.product.name,
      variant: detail || "Standard",
      sku: v.sku,
      category: v.product.category?.name ?? "Uncategorised",
      brand: v.product.brand?.name ?? "No brand",
      qty: v.quantity,
      min,
      cost: num(v.purchasePrice),
      price: num(v.sellingPrice),
      status: v.quantity <= 0 ? "Out of stock" : v.quantity <= min ? "Low stock" : "In stock",
    };
  });
}

const stockCols: Col[] = [text("name", "Product"), text("variant", "Variant"), text("sku", "SKU"), text("category", "Category"), int("qty", "Quantity"), money("cost", "Cost Price"), money("price", "Selling Price"), money("value", "Stock Value (cost)"), text("status", "Status")];

export async function inventoryCurrent(f: Filters, _c: Ctx): Promise<Body> {
  const v = await loadVariants(f);
  const rows: Row[] = v.map((x) => ({ ...x, value: round2(x.qty * x.cost) }));
  return {
    cards: [
      { label: "Products (variants)", value: v.length, fmt: "int" },
      { label: "Units in Stock", value: sumBy(v, (x) => x.qty), fmt: "int" },
      { label: "Stock Value (cost)", value: round2(sumBy(v, (x) => x.qty * x.cost)), fmt: "money" },
    ],
    notes: ["Shows stock right now, not for the chosen dates. Only active products are included."],
    tables: [{ cols: stockCols, rows, totals: totalsRow("Total", rows, ["qty", "value"], "name") }],
  };
}

export async function inventoryValuation(f: Filters, _c: Ctx): Promise<Body> {
  const v = await loadVariants(f);
  const cost = sumBy(v, (x) => x.qty * x.cost);
  const retail = sumBy(v, (x) => x.qty * x.price);
  const byCat = new Map<string, { units: number; cost: number; retail: number }>();
  for (const x of v) {
    const e = byCat.get(x.category) ?? { units: 0, cost: 0, retail: 0 };
    e.units += x.qty;
    e.cost += x.qty * x.cost;
    e.retail += x.qty * x.price;
    byCat.set(x.category, e);
  }
  const rows: Row[] = [...byCat.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([category, e]) => ({ category, units: e.units, cost: round2(e.cost), retail: round2(e.retail), margin: round2(e.retail - e.cost) }));
  return {
    cards: [
      { label: "Stock at Cost", value: round2(cost), fmt: "money", hint: "Quantity × cost price" },
      { label: "Stock at Selling Price", value: round2(retail), fmt: "money", hint: "Quantity × selling price" },
      { label: "Potential Profit", value: round2(retail - cost), fmt: "money", tone: "good" },
      { label: "Units in Stock", value: sumBy(v, (x) => x.qty), fmt: "int" },
    ],
    notes: ["Shows stock right now, not for the chosen dates."],
    charts: [{ kind: "donut", title: "Stock value by category (cost)", money: true, data: rows.map((r) => ({ name: String(r.category), cost: Number(r.cost) })), series: [{ key: "cost", label: "Cost" }] }],
    tables: [{ title: "By category", cols: [text("category", "Category"), int("units", "Units"), money("cost", "Value at Cost"), money("retail", "Value at Selling Price"), money("margin", "Potential Profit")], rows, totals: totalsRow("Total", rows, ["units", "cost", "retail", "margin"], "category") }],
  };
}

export async function inventoryLow(f: Filters, _c: Ctx): Promise<Body> {
  const v = (await loadVariants(f)).filter((x) => x.status === "Low stock");
  const rows: Row[] = v.map((x) => ({ ...x, value: round2(x.qty * x.cost), short: Math.max(0, x.min - x.qty) }));
  return {
    cards: [{ label: "Variants Running Low", value: v.length, fmt: "int", tone: v.length ? "bad" : undefined }],
    notes: ["Stock right now, compared with each product's minimum stock level."],
    tables: [{ cols: [text("name", "Product"), text("variant", "Variant"), text("sku", "SKU"), text("category", "Category"), int("qty", "In Stock"), int("min", "Minimum"), int("short", "Below Minimum By")], rows }],
  };
}

export async function inventoryOut(f: Filters, _c: Ctx): Promise<Body> {
  const v = (await loadVariants(f)).filter((x) => x.qty <= 0);
  const rows: Row[] = v.map((x) => ({ ...x }));
  return {
    cards: [{ label: "Out-of-stock Variants", value: v.length, fmt: "int", tone: v.length ? "bad" : undefined }],
    notes: ["Stock right now."],
    tables: [{ cols: [text("name", "Product"), text("variant", "Variant"), text("sku", "SKU"), text("category", "Category"), text("brand", "Brand"), money("cost", "Cost Price")], rows }],
  };
}

const ADJUST_TYPES = ["ADJUSTMENT", "DAMAGE", "LOSS"] as const;

export async function inventoryMovement(f: Filters, _c: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const variants = await loadVariants(f);
  const ids = variants.map((x) => x.id);
  const moves = await prisma.stockMovement.findMany({
    where: { productVariantId: { in: ids }, createdAt: { gte: start } },
    select: { productVariantId: true, type: true, quantityChange: true, createdAt: true },
  });
  const per = new Map<string, { after: number; purchased: number; sold: number; returned: number; adjusted: number; other: number; net: number }>();
  for (const m of moves) {
    const e = per.get(m.productVariantId) ?? { after: 0, purchased: 0, sold: 0, returned: 0, adjusted: 0, other: 0, net: 0 };
    if (m.createdAt >= end) {
      e.after += m.quantityChange;
    } else {
      e.net += m.quantityChange;
      if (m.type === "PURCHASE") e.purchased += m.quantityChange;
      else if (m.type === "SALE") e.sold += -m.quantityChange;
      else if (m.type === "CUSTOMER_RETURN") e.returned += m.quantityChange;
      else if ((ADJUST_TYPES as readonly string[]).includes(m.type)) e.adjusted += m.quantityChange;
      else e.other += m.quantityChange;
    }
    per.set(m.productVariantId, e);
  }
  const rows: Row[] = variants
    .map((x) => {
      const e = per.get(x.id) ?? { after: 0, purchased: 0, sold: 0, returned: 0, adjusted: 0, other: 0, net: 0 };
      const closing = x.qty - e.after;
      return { name: x.name, variant: x.variant, sku: x.sku, opening: closing - e.net, purchased: e.purchased, sold: e.sold, returned: e.returned, adjusted: e.adjusted, other: e.other, closing, moved: e.purchased + e.sold + e.returned + Math.abs(e.adjusted) + Math.abs(e.other) };
    })
    .filter((r) => Number(r.moved) > 0 || Number(r.closing) !== 0)
    .map(({ moved: _moved, ...r }) => r);
  return {
    notes: ["\"Other\" covers opening stock and supplier returns. Each row is one product variant."],
    tables: [{ cols: [text("name", "Product"), text("variant", "Variant"), text("sku", "SKU"), int("opening", "Opening"), int("purchased", "Purchased"), int("sold", "Sold"), int("returned", "Customer Returns"), int("adjusted", "Adjustments"), int("other", "Other"), int("closing", "Closing")], rows }],
  };
}

export async function inventoryAdjustments(f: Filters, _c: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const variants = await loadVariants(f);
  const info = new Map(variants.map((v) => [v.id, v]));
  const all = await prisma.stockMovement.findMany({
    where: { productVariantId: { in: [...info.keys()] }, createdAt: { gte: start } },
    orderBy: { createdAt: "desc" },
    select: { id: true, productVariantId: true, type: true, quantityChange: true, reason: true, createdAt: true, createdBy: { select: { name: true } } },
  });
  // Walk back from today's quantity to find the quantity before and after each change.
  const running = new Map<string, number>();
  const rows: Row[] = [];
  for (const m of all) {
    const v = info.get(m.productVariantId)!;
    const after = running.get(m.productVariantId) ?? v.qty;
    const before = after - m.quantityChange;
    running.set(m.productVariantId, before);
    if (m.createdAt >= end || !(ADJUST_TYPES as readonly string[]).includes(m.type)) continue;
    rows.push({
      date: m.createdAt.toISOString(),
      name: v.name,
      variant: v.variant,
      type: m.type === "ADJUSTMENT" ? "Adjustment" : m.type === "DAMAGE" ? "Damage" : "Loss",
      before,
      change: m.quantityChange,
      after,
      reason: m.reason ?? "",
      by: m.createdBy.name,
    });
  }
  return {
    cards: [
      { label: "Adjustments", value: rows.length, fmt: "int" },
      { label: "Units Added", value: sumBy(rows, (r) => Math.max(0, Number(r.change))), fmt: "int" },
      { label: "Units Removed", value: sumBy(rows, (r) => Math.max(0, -Number(r.change))), fmt: "int" },
    ],
    tables: [{ cols: [date("date", "Date"), text("name", "Product"), text("variant", "Variant"), text("type", "Type"), int("before", "Previous Qty"), int("change", "Change"), int("after", "New Qty"), text("reason", "Reason"), text("by", "User")], rows }],
  };
}

// ---------------------------------------------------------------- product performance

export async function productsFast(f: Filters, ctx: Ctx): Promise<Body> {
  const { lines } = await loadSales(f);
  const groups = groupLines(lines, (l) => l.productId, (l) => l.productName.split(" - ")[0]).sort((a, b) => b.t.qty - a.t.qty).slice(0, 25);
  const profit = ctx.can("reports.gross_profit");
  const rows: Row[] = groups.map((g) => ({
    product: g.label,
    category: g.first.category,
    qty: g.t.qty,
    sales: round2(g.t.net),
    profit: round2(g.t.profit),
    last: g.lines.reduce((a, l) => (l.at > a ? l.at : a), g.lines[0].at).toISOString(),
  }));
  const cols: Col[] = [text("product", "Product"), text("category", "Category"), int("qty", "Quantity Sold"), money("sales", "Sales")];
  if (profit) cols.push(money("profit", "Profit"));
  cols.push(date("last", "Last Sale"));
  return {
    charts: [{ kind: "hbar", title: "Top products by quantity", data: rows.slice(0, 8).map((r) => ({ name: String(r.product), qty: Number(r.qty) })), series: [{ key: "qty", label: "Quantity sold" }] }],
    tables: [{ title: "Top 25 products in the period", cols, rows }],
  };
}

export async function productsSlow(f: Filters, _c: Ctx): Promise<Body> {
  const { lines } = await loadSales(f);
  const sold = new Map<string, number>();
  for (const l of lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.qty);

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", ...(f.categoryId ? { categoryId: f.categoryId } : {}), ...(f.brandId ? { brandId: f.brandId } : {}) },
    select: { id: true, name: true, category: { select: { name: true } }, variants: { where: { status: "ACTIVE" }, select: { quantity: true, purchasePrice: true } } },
  });
  const lastSales = await prisma.saleItem.findMany({
    where: { sale: { status: { not: "CANCELLED" } } },
    select: { productVariant: { select: { productId: true } }, sale: { select: { createdAt: true } } },
    orderBy: { sale: { createdAt: "desc" } },
  });
  const last = new Map<string, Date>();
  for (const s of lastSales) if (!last.has(s.productVariant.productId)) last.set(s.productVariant.productId, s.sale.createdAt);

  const today = nepalDay(new Date());
  const rows: Row[] = products
    .map((p) => {
      const qty = p.variants.reduce((a, v) => a + v.quantity, 0);
      const value = p.variants.reduce((a, v) => a + v.quantity * num(v.purchasePrice), 0);
      const ls = last.get(p.id);
      const days = ls ? Math.max(0, daysBetween(nepalDay(ls), today) - 1) : null;
      return { product: p.name, category: p.category?.name ?? "Uncategorised", stock: qty, sold: sold.get(p.id) ?? 0, last: ls ? ls.toISOString() : null, days, value: round2(value) };
    })
    .filter((r) => Number(r.stock) > 0)
    .sort((a, b) => (b.days ?? 99999) - (a.days ?? 99999) || Number(a.sold) - Number(b.sold));
  return {
    cards: [{ label: "Products With Stock", value: rows.length, fmt: "int" }, { label: "Not Sold in Period", value: rows.filter((r) => Number(r.sold) === 0).length, fmt: "int", tone: "bad" }],
    notes: ["Stock is as of now. \"Days since last sale\" is blank for products that have never sold."],
    tables: [{ cols: [text("product", "Product"), text("category", "Category"), int("stock", "Current Stock"), int("sold", "Sold in Period"), date("last", "Last Sale"), int("days", "Days Since Last Sale"), money("value", "Stock Value (cost)")], rows }],
  };
}

// ---------------------------------------------------------------- customers

export async function customersSummary(f: Filters, _c: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const [total, fresh, credits, sales, earlier] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.customerCredit.findMany({ select: { customerId: true, amount: true, amountPaid: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" }, customerId: { not: null } }, select: { customerId: true, total: true } }),
    prisma.sale.findMany({ where: { createdAt: { lt: start }, status: { not: "CANCELLED" }, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"] }),
  ]);
  const owing = new Map<string, number>();
  for (const c of credits) owing.set(c.customerId, (owing.get(c.customerId) ?? 0) + (num(c.amount) - num(c.amountPaid)));
  const withCredit = [...owing.values()].filter((v) => v > 0.005);
  const buyers = new Set(sales.map((s) => s.customerId as string));
  const before = new Set(earlier.map((s) => s.customerId as string));
  return {
    cards: [
      { label: "Total Customers", value: total, fmt: "int" },
      { label: "New Customers", value: fresh, fmt: "int" },
      { label: "Returning Customers", value: [...buyers].filter((id) => before.has(id)).length, fmt: "int", hint: "Bought in the period and before" },
      { label: "Customers With Credit", value: withCredit.length, fmt: "int" },
      { label: "Total Customer Credit", value: round2(sumBy(withCredit, (v) => v)), fmt: "money", tone: "bad" },
      { label: "Customer Spending", value: round2(sumBy(sales, (s) => num(s.total))), fmt: "money" },
    ],
    notes: ["Credit is the amount owed right now. Walk-in sales without a customer aren't counted in spending."],
  };
}

export async function customersTop(f: Filters, _c: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const [sales, credits] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" }, customerId: { not: null } }, select: { customerId: true, total: true, customer: { select: { name: true, phone: true } } } }),
    prisma.customerCredit.findMany({ select: { customerId: true, amount: true, amountPaid: true } }),
  ]);
  const owing = new Map<string, number>();
  for (const c of credits) owing.set(c.customerId, (owing.get(c.customerId) ?? 0) + (num(c.amount) - num(c.amountPaid)));
  const m = new Map<string, { name: string; phone: string; n: number; total: number }>();
  for (const s of sales) {
    const id = s.customerId as string;
    const e = m.get(id) ?? { name: s.customer?.name ?? "", phone: s.customer?.phone ?? "", n: 0, total: 0 };
    e.n++;
    e.total += num(s.total);
    m.set(id, e);
  }
  const rows: Row[] = [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 25).map(([id, e]) => ({ name: e.name, phone: e.phone, n: e.n, total: round2(e.total), avg: round2(e.total / e.n), owing: round2(Math.max(0, owing.get(id) ?? 0)) }));
  return { tables: [{ title: "Top 25 customers by spending", cols: [text("name", "Customer"), text("phone", "Phone"), int("n", "Purchases"), money("total", "Total Spending"), money("avg", "Average Purchase"), money("owing", "Outstanding Credit")], rows }] };
}

export async function customersCredit(f: Filters, _c: Ctx): Promise<Body> {
  const credits = await prisma.customerCredit.findMany({
    where: f.customerId ? { customerId: f.customerId } : {},
    select: { customerId: true, amount: true, amountPaid: true, createdAt: true, dueDate: true, customer: { select: { name: true, phone: true, sales: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } } },
  });
  const m = new Map<string, { name: string; phone: string; credit: number; paid: number; due: Date | null; lastSale: Date | null }>();
  for (const c of credits) {
    const e = m.get(c.customerId) ?? { name: c.customer.name, phone: c.customer.phone ?? "", credit: 0, paid: 0, due: null, lastSale: c.customer.sales[0]?.createdAt ?? null };
    e.credit += num(c.amount);
    e.paid += num(c.amountPaid);
    if (c.dueDate && (!e.due || c.dueDate < e.due)) e.due = c.dueDate;
    m.set(c.customerId, e);
  }
  const rows: Row[] = [...m.values()].map((e) => ({ name: e.name, phone: e.phone, credit: round2(e.credit), paid: round2(e.paid), left: round2(e.credit - e.paid), due: e.due ? e.due.toISOString() : null, lastSale: e.lastSale ? e.lastSale.toISOString() : null })).sort((a, b) => Number(b.left) - Number(a.left));
  return {
    cards: [{ label: "Customers Owing", value: rows.filter((r) => Number(r.left) > 0.005).length, fmt: "int" }, { label: "Total Outstanding", value: round2(sumBy(rows, (r) => Number(r.left))), fmt: "money", tone: "bad" }],
    notes: ["Shows what is owed right now. Credit payments aren't dated, so the last payment date isn't available."],
    tables: [{ cols: [text("name", "Customer"), text("phone", "Phone"), money("credit", "Total Credit"), money("paid", "Paid"), money("left", "Remaining"), date("due", "Next Due Date"), date("lastSale", "Last Purchase")], rows, totals: totalsRow("Total", rows, ["credit", "paid", "left"], "name") }],
  };
}

// ---------------------------------------------------------------- expenses, staff, closing

export async function expensesReport(f: Filters, _c: Ctx): Promise<Body> {
  const list = await loadExpenses(f);
  const sum = (key: (e: (typeof list)[number]) => string) => {
    const m = new Map<string, { n: number; amount: number }>();
    for (const e of list) {
      const k = key(e);
      const x = m.get(k) ?? { n: 0, amount: 0 };
      x.n++;
      x.amount += e.amount;
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([name, x]) => ({ name, n: x.n, amount: round2(x.amount) })) as Row[];
  };
  const total = sumBy(list, (e) => e.amount);
  const byCat = sum((e) => e.category);
  const keys = bucketKeys(f.from, f.to);
  const days = new Map(keys.map((k) => [k, 0]));
  for (const e of list) {
    const k = bucketKey(e.day, f.from, f.to);
    days.set(k, (days.get(k) ?? 0) + e.amount);
  }
  const dayRows: Row[] = keys.map((k) => ({ name: bucketLabel(k), amount: round2(days.get(k) ?? 0) }));
  const withShare = (rows: Row[]) => rows.map((r) => ({ ...r, share: pct(Number(r.amount), total) }));
  const cols = (label: string): Col[] => [text("name", label), int("n", "Entries"), money("amount", "Amount"), pctCol("share", "Share")];
  return {
    cards: [
      { label: "Total Expenses", value: round2(total), fmt: "money" },
      { label: "Paid", value: round2(sumBy(list.filter((e) => e.status === "PAID"), (e) => e.amount)), fmt: "money" },
      { label: "Unpaid", value: round2(sumBy(list.filter((e) => e.status !== "PAID"), (e) => e.amount)), fmt: "money", tone: "bad" },
      { label: "Entries", value: list.length, fmt: "int" },
    ],
    charts: [
      { kind: "donut", title: "Expenses by category", money: true, data: byCat.map((r) => ({ name: String(r.name), amount: Number(r.amount) })), series: [{ key: "amount", label: "Amount" }] },
      { kind: "bar", title: "Expenses by date", money: true, data: dayRows.map((r) => ({ name: String(r.name), amount: Number(r.amount) })), series: [{ key: "amount", label: "Expenses" }] },
    ],
    tables: [
      { title: "By category", cols: cols("Category"), rows: withShare(byCat), totals: totalsRow("Total", byCat, ["n", "amount"], "name") },
      { title: "By payment method", cols: cols("Method"), rows: withShare(sum((e) => methodLabel(e.method))) },
      { title: "By user", cols: cols("User"), rows: withShare(sum((e) => e.by)) },
      { title: "By date", cols: [text("name", "Period"), money("amount", "Amount")], rows: dayRows, totals: totalsRow("Total", dayRows, ["amount"], "name") },
    ],
  };
}

export async function staffActivity(f: Filters, _c: Ctx): Promise<Body> {
  const { start, end } = toInstants(f.from, f.to);
  const [users, { lines }, returns, moves, expenses] = await Promise.all([
    prisma.user.findMany({ where: f.staffId ? { id: f.staffId } : {}, select: { id: true, name: true, userId: true } }),
    loadSales({ ...f, staffId: undefined }),
    loadReturns({ ...f, staffId: undefined }),
    prisma.stockMovement.findMany({ where: { createdAt: { gte: start, lt: end }, type: { in: [...ADJUST_TYPES] } }, select: { createdById: true } }),
    loadExpenses({ ...f, staffId: undefined }),
  ]);
  const rows: Row[] = users.map((u) => {
    const mine = lines.filter((l) => l.staffId === u.id);
    const t = totalsOf(mine);
    return {
      staff: `${u.name} (${u.userId})`,
      sales: t.invoices,
      value: round2(t.net),
      disc: round2(t.discounts),
      returns: returns.filter((r) => r.type === "RETURN" && r.staff === u.name).length,
      adjustments: moves.filter((m) => m.createdById === u.id).length,
      expenses: expenses.filter((e) => e.by === u.name).length,
    };
  });
  return {
    notes: ["This shows how much business each person handled. For exactly what a person did in the system, use the Audit Log."],
    tables: [{ cols: [text("staff", "Staff"), int("sales", "Sales Completed"), money("value", "Sales Value"), money("disc", "Discounts Given"), int("returns", "Returns (their sales)"), int("adjustments", "Stock Adjustments"), int("expenses", "Expenses Recorded")], rows, totals: totalsRow("Total", rows, ["sales", "value", "disc", "returns", "adjustments", "expenses"], "staff") }],
  };
}

export async function dailyClosing(f: Filters, _c: Ctx): Promise<Body> {
  const [{ lines, sales }, returns, expenses] = await Promise.all([loadSales(f), loadReturns(f), loadExpenses(f)]);
  const t = totalsOf(lines);
  const by: Record<string, number> = {};
  for (const s of sales) for (const p of s.payments) by[p.method] = (by[p.method] ?? 0) + p.amount;
  const cash = by.CASH ?? 0;
  const digital = sumBy(DIGITAL, (m) => by[m] ?? 0);
  const refunds = sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.amount);
  const cashRefunds = sumBy(returns.filter((r) => r.type === "RETURN" && !r.storeCredit), (r) => r.amount);
  const cashExpenses = sumBy(expenses.filter((e) => e.method === "CASH" && e.status === "PAID"), (e) => e.amount);
  const expected = cash - cashRefunds - cashExpenses;
  return {
    cards: [
      { label: "Cash Sales", value: round2(cash), fmt: "money" },
      { label: "Digital Sales", value: round2(digital), fmt: "money" },
      { label: "Credit Sales", value: round2(by.CREDIT ?? 0), fmt: "money" },
      { label: "Total Sales", value: round2(t.net), fmt: "money", tone: "good" },
      { label: "Discounts", value: round2(t.discounts), fmt: "money" },
      { label: "Returns", value: round2(refunds), fmt: "money" },
      { label: "Expenses", value: round2(sumBy(expenses, (e) => e.amount)), fmt: "money" },
    ],
    cashRecon: {
      lines: [
        { label: "Cash sales", value: round2(cash) },
        { label: "less Cash refunds", value: -round2(cashRefunds) },
        { label: "less Cash expenses (paid)", value: -round2(cashExpenses) },
      ],
    },
    notes: [
      "Add the cash that was in the till when you opened to get the cash you should be holding, then type what you counted to see the difference.",
      "Payments received later on old credit sales aren't dated in the system, so they aren't included.",
    ],
  };
}

// ---------------------------------------------------------------- overview

export async function overview(f: Filters, ctx: Ctx): Promise<Body> {
  const needSales = ctx.can("reports.sales") || ctx.can("reports.gross_profit") || ctx.can("reports.net_profit");
  const [sold, returns, expenses, credits] = await Promise.all([
    needSales ? loadSales(f) : Promise.resolve(null),
    ctx.can("reports.sales") || needSales ? loadReturns(f) : Promise.resolve([]),
    ctx.can("reports.expense") || ctx.can("reports.net_profit") ? loadExpenses({ ...f, method: undefined, staffId: undefined }) : Promise.resolve([]),
    ctx.can("reports.customers") ? prisma.customerCredit.aggregate({ _sum: { amount: true, amountPaid: true } }) : Promise.resolve(null),
  ]);

  const cards: Card[] = [];
  const charts: ChartSpec[] = [];
  if (sold) {
    const t = totalsOf(sold.lines);
    const refunds = sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.amount);
    const net = t.gross - t.discounts - refunds;
    const gp = net - (t.cost - sumBy(returns.filter((r) => r.type === "RETURN"), (r) => r.cost));
    const exp = sumBy(expenses, (e) => e.amount);
    if (ctx.can("reports.sales")) cards.push({ label: "Total Sales", value: round2(net), fmt: "money", hint: "Net of discounts and returns" });
    if (ctx.can("reports.gross_profit")) cards.push({ label: "Gross Profit", value: round2(gp), fmt: "money", tone: gp >= 0 ? "good" : "bad" });
    if (ctx.can("reports.expense")) cards.push({ label: "Total Expenses", value: round2(exp), fmt: "money" });
    if (ctx.can("reports.net_profit")) cards.push({ label: "Net Profit", value: round2(gp - exp), fmt: "money", tone: gp - exp >= 0 ? "good" : "bad" });
    if (ctx.can("reports.sales")) {
      cards.push({ label: "Sales Returns", value: round2(refunds), fmt: "money" }, { label: "Total Discounts", value: round2(t.discounts), fmt: "money" });
    }

    if (ctx.can("reports.sales")) {
      const keys = bucketKeys(f.from, f.to);
      const m = new Map(keys.map((k) => [k, { sales: 0, exp: 0 }]));
      for (const l of sold.lines) m.get(bucketKey(l.day, f.from, f.to))!.sales += l.net;
      for (const e of expenses) {
        const x = m.get(bucketKey(e.day, f.from, f.to));
        if (x) x.exp += e.amount;
      }
      const showExp = ctx.can("reports.expense");
      charts.push({
        kind: "line",
        title: showExp ? "Sales vs expenses" : "Sales trend",
        money: true,
        data: keys.map((k) => ({ name: bucketLabel(k), sales: round2(m.get(k)!.sales), exp: round2(m.get(k)!.exp) })),
        series: [{ key: "sales", label: "Sales" }, ...(showExp ? [{ key: "exp", label: "Expenses" }] : [])],
      });
      const cat = groupLines(sold.lines, (l) => l.category);
      charts.push({ kind: "donut", title: "Sales by category", money: true, data: cat.map((g) => ({ name: g.label, net: round2(g.t.net) })), series: [{ key: "net", label: "Sales" }] });
      const pay: Record<string, number> = {};
      for (const s of sold.sales) for (const p of s.payments) pay[p.method] = (pay[p.method] ?? 0) + p.amount;
      charts.push({ kind: "donut", title: "Payment methods", money: true, data: Object.entries(pay).map(([k, v]) => ({ name: methodLabel(k), amount: round2(v) })), series: [{ key: "amount", label: "Amount" }] });
      const top = groupLines(sold.lines, (l) => l.variantId, (l) => l.productName).slice(0, 6);
      charts.push({ kind: "hbar", title: "Top products", money: true, data: top.map((g) => ({ name: g.label, net: round2(g.t.net) })), series: [{ key: "net", label: "Sales" }] });
    }
  }
  if (credits) cards.push({ label: "Outstanding Credit", value: round2(num(credits._sum.amount) - num(credits._sum.amountPaid)), fmt: "money", tone: "bad" });

  return { cards, charts, notes: ["You only see the figures your account has permission for."] };
}

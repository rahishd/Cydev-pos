import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}

const file = (body: string, name: string, type: string) =>
  new NextResponse(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const access = await getAccess();
  if (!access) return new NextResponse("Forbidden", { status: 403 });

  const { kind } = await params;
  const needs: Record<string, string> = {
    products: "products.view",
    sales: "sales.history",
    customers: "customers.view",
    expenses: "expenses.view",
  };
  if (kind === "full") {
    if (!access.isOwner) return new NextResponse("Forbidden", { status: 403 });
  } else if (needs[kind]) {
    if (!access.isOwner && !(access.can("data.export") && access.can(needs[kind]))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "full" || ["products", "sales", "customers", "expenses"].includes(kind)) {
    await logAudit({
      actor: access,
      action: "export",
      title: kind === "full" ? "Full Backup Downloaded" : "Data Exported",
      module: "Backup",
      entityType: "Backup",
      entityId: kind,
      description: kind === "full" ? "Downloaded full database backup (JSON)" : `Exported ${kind} to CSV`,
    });
  }

  if (kind === "full") {
    const [
      users, categories, brands, products, variants, suppliers, purchases, purchaseItems,
      stockMovements, customers, sales, saleItems, payments, invoices, saleReturns,
      customerCredits, expenseCategories, expenses, auditLogs, settings,
    ] = await Promise.all([
      prisma.user.findMany({ select: { id: true, userId: true, name: true, contactNumber: true, role: true, status: true, permissions: true, lastLoginAt: true, createdAt: true } }),
      prisma.category.findMany(),
      prisma.brand.findMany(),
      prisma.product.findMany(),
      prisma.productVariant.findMany(),
      prisma.supplier.findMany(),
      prisma.purchase.findMany(),
      prisma.purchaseItem.findMany(),
      prisma.stockMovement.findMany(),
      prisma.customer.findMany(),
      prisma.sale.findMany(),
      prisma.saleItem.findMany(),
      prisma.payment.findMany(),
      prisma.invoice.findMany(),
      prisma.saleReturn.findMany(),
      prisma.customerCredit.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.expense.findMany(),
      prisma.auditLog.findMany(),
      prisma.systemSettings.findMany(),
    ]);
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        note: "Password hashes are intentionally not included.",
        users, categories, brands, products, variants, suppliers, purchases, purchaseItems,
        stockMovements, customers, sales, saleItems, payments, invoices, saleReturns,
        customerCredits, expenseCategories, expenses, auditLogs, settings,
      },
      null,
      2
    );
    return file(body, `Labash-Fashion-backup-${stamp}.json`, "application/json");
  }

  const tables: Record<string, () => Promise<Record<string, unknown>[]>> = {
    products: () =>
      prisma.productVariant
        .findMany({ include: { product: { select: { name: true } } } })
        .then((rows) =>
          rows.map((v) => ({
            product: v.product.name, sku: v.sku, size: v.size, color: v.color, quantity: v.quantity,
            purchasePrice: v.purchasePrice, sellingPrice: v.sellingPrice, minStockLevel: v.minStockLevel, status: v.status,
          }))
        ),
    sales: () =>
      prisma.sale
        .findMany({ include: { customer: { select: { name: true } }, staff: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
        .then((rows) =>
          rows.map((s) => ({
            invoiceNo: s.invoiceNo, date: s.createdAt, customer: s.customer?.name ?? "Walk-in", staff: s.staff.name,
            subtotal: s.subtotal, discount: s.discount, tax: s.tax, total: s.total, amountPaid: s.amountPaid, status: s.status,
          }))
        ),
    customers: () =>
      prisma.customer.findMany().then((rows) =>
        rows.map((c) => ({ name: c.name, phone: c.phone, email: c.email, address: c.address, createdAt: c.createdAt }))
      ),
    expenses: () =>
      prisma.expense
        .findMany({ include: { category: { select: { name: true } } }, orderBy: { date: "desc" } })
        .then((rows) =>
          rows.map((e) => ({
            date: e.date, category: e.category.name, amount: e.amount, method: e.paymentMethod,
            status: e.status, description: e.description,
          }))
        ),
  };

  const loader = tables[kind];
  if (!loader) return new NextResponse("Not found", { status: 404 });
  return file(toCsv(await loader()), `${kind}-${stamp}.csv`, "text/csv");
}

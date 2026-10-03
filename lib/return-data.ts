import { prisma } from "@/lib/prisma";
import type { ReturnReceiptData } from "@/lib/return-pdf";

const variantLabel = (size: string | null, color: string | null) => [size, color].filter(Boolean).join(" / ");

/** Everything the return / exchange receipt needs, or null if that return doesn't exist. */
export async function loadReturnReceipt(id: string): Promise<(ReturnReceiptData & { customerName: string | null }) | null> {
  const r = await prisma.saleReturn.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      quantity: true,
      reason: true,
      refundAmount: true,
      refunded: true,
      refundMethod: true,
      storeCredit: true,
      priceDifference: true,
      newVariantId: true,
      saleItemId: true,
      createdAt: true,
      sale: {
        select: {
          invoiceNo: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              total: true,
              productVariant: { select: { size: true, color: true, product: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!r) return null;

  // Returns saved before lines were tracked belong to the only line of a one-item sale.
  const line = r.sale.items.find((i) => i.id === r.saleItemId) ?? (r.sale.items.length === 1 ? r.sale.items[0] : null);
  const amount = Number(r.refundAmount);

  const [newV, audit] = await Promise.all([
    r.newVariantId
      ? prisma.productVariant.findUnique({
          where: { id: r.newVariantId },
          select: { size: true, color: true, product: { select: { name: true } } },
        })
      : Promise.resolve(null),
    prisma.auditLog.findFirst({ where: { affectedType: "SaleReturn", affectedId: id }, select: { userName: true } }),
  ]);

  return {
    returnNo: `RET-${r.id.slice(-6).toUpperCase()}`,
    type: r.type as "RETURN" | "EXCHANGE",
    date: r.createdAt,
    invoiceNo: r.sale.invoiceNo,
    invoiceDate: r.sale.createdAt,
    customer: r.sale.customer ? { name: r.sale.customer.name, phone: r.sale.customer.phone ?? undefined } : null,
    customerName: r.sale.customer?.name ?? null,
    item: {
      name: line?.productVariant.product.name ?? "Item",
      variant: line ? variantLabel(line.productVariant.size, line.productVariant.color) : "",
      quantity: r.quantity,
      unitPaid: r.quantity > 0 ? amount / r.quantity : amount,
    },
    amount,
    refundMethod: r.refundMethod ?? (r.storeCredit ? "STORE_CREDIT" : "CASH"),
    refunded: r.refunded,
    reason: r.reason ?? "",
    priceDifference: r.priceDifference === null ? null : Number(r.priceDifference),
    newItem: newV ? `${newV.product.name}${variantLabel(newV.size, newV.color) ? " (" + variantLabel(newV.size, newV.color) + ")" : ""}` : null,
    processedBy: audit?.userName ?? null,
  };
}

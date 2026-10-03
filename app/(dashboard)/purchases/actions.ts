"use server";

import { assertPermission } from "@/lib/access";
import { logAudit, npr } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { formatNumber } from "@/lib/settings-schema";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getPurchasesPageData(
  search?: string,
  supplierId?: string,
  status?: string,
  paymentStatus?: string
) {
  await assertPermission("purchases.view");
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { purchaseNo: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (supplierId) {
    whereClause.supplierId = supplierId;
  }

  if (status) {
    whereClause.status = status;
  }

  // Fetch purchases
  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    select: {
      id: true,
      purchaseNo: true,
      date: true,
      total: true,
      paidAmount: true,
      status: true,
      supplier: { select: { id: true, name: true } },
      items: { select: { id: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
  });

  // Filter by payment status if specified
  let filteredPurchases = purchases;
  if (paymentStatus === "paid") {
    filteredPurchases = purchases.filter((p) => {
      const paid = Number(p.paidAmount);
      const total = Number(p.total);
      return paid >= total;
    });
  } else if (paymentStatus === "partial") {
    filteredPurchases = purchases.filter((p) => {
      const paid = Number(p.paidAmount);
      const total = Number(p.total);
      return paid > 0 && paid < total;
    });
  } else if (paymentStatus === "unpaid") {
    filteredPurchases = purchases.filter((p) => Number(p.paidAmount) === 0);
  }

  // Calculate KPIs
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const pendingOrders = purchases.filter((p) => p.status === "ORDERED" || p.status === "PARTIALLY_RECEIVED").length;
  const receivedCount = purchases.filter((p) => p.status === "RECEIVED").length;
  const outstandingPayables = purchases.reduce(
    (sum, p) => sum + (Number(p.total) - Number(p.paidAmount)),
    0
  );

  // Get suppliers for filter
  const suppliers = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return {
    purchases: filteredPurchases.map((p) => ({
      ...p,
      total: Number(p.total),
      paidAmount: Number(p.paidAmount),
      discount: Number(p.discount),
      otherCosts: Number(p.otherCosts),
      outstanding: Number(p.total) - Number(p.paidAmount),
      itemCount: p.items.length,
    })),
    kpi: {
      totalPurchases,
      pendingOrders,
      receivedCount,
      outstandingPayables,
    },
    suppliers,
    filters: {
      search,
      supplierId,
      status,
      paymentStatus,
    },
  };
}

export async function getPurchaseDetails(purchaseId: string) {
  await assertPermission("purchases.view");
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      purchaseNo: true,
      date: true,
      total: true,
      discount: true,
      otherCosts: true,
      paidAmount: true,
      status: true,
      supplier: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          purchasePrice: true,
          discount: true,
          productVariant: {
            select: {
              sku: true,
              size: true,
              color: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          method: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!purchase) throw new Error("Purchase not found");

  // Get received quantities
  const receivedQtys = await Promise.all(
    purchase.items.map(async (item) => {
      const movements = await prisma.stockMovement.findMany({
        where: {
          productVariantId: item.productVariantId,
          type: "PURCHASE",
          referenceId: purchaseId,
        },
        select: { quantityChange: true },
      });
      const received = movements.reduce((sum, m) => sum + m.quantityChange, 0);
      return { itemId: item.id, received };
    })
  );

  return {
    purchase,
    receivedQtys: new Map(receivedQtys.map((r) => [r.itemId, r.received])),
  };
}

export async function createPurchase(
  supplierId: string,
  date: Date,
  items: Array<{ variantId: string; quantity: number; purchasePrice: string; discount: number }>,
  discount: number,
  otherCosts: number,
  paymentMethod: string,
  supplierInvoiceRef?: string,
  notes?: string
) {
  const access = await assertPermission("purchases.create");
  // Generate purchase number
  const lastPurchase = await prisma.purchase.findFirst({
    orderBy: { createdAt: "desc" },
    select: { purchaseNo: true },
  });

  const purchaseSettings = (await getSettings()).purchases;
  const lastNum = parseInt(/(\d+)$/.exec(lastPurchase?.purchaseNo ?? "")?.[1] ?? "0", 10) || 0;
  const newPurchaseNo = formatNumber(
    String(purchaseSettings.prefix ?? "PUR-"),
    Math.max(lastNum + 1, Number(purchaseSettings.startingNumber) || 1),
    Number(purchaseSettings.numberDigits) || 6
  );

  // Calculate totals
  let subtotal = 0;
  const purchaseItems = items.map((item) => {
    const itemTotal = Number(item.purchasePrice) * item.quantity - item.discount;
    subtotal += itemTotal;
    return {
      productVariantId: item.variantId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      discount: item.discount,
      total: itemTotal,
    };
  });

  const total = subtotal - discount + otherCosts;

  // Create purchase
  const purchase = await prisma.purchase.create({
    data: {
      purchaseNo: newPurchaseNo,
      supplierId,
      date,
      total: new Decimal(total),
      discount: new Decimal(discount),
      otherCosts: new Decimal(otherCosts),
      paidAmount: new Decimal(0),
      status: "DRAFT",
      createdById: access.id,
      items: {
        create: purchaseItems.map((item) => ({
          productVariantId: item.productVariantId,
          quantityOrdered: item.quantity,
          purchasePrice: new Decimal(item.purchasePrice),
        })),
      },
    },
    select: { id: true, purchaseNo: true },
  });

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } });
  await logAudit({
    actor: access,
    action: "created",
    title: "Created Purchase",
    module: "Purchases",
    entityType: "Purchase",
    entityId: purchase.id,
    description: `Created purchase ${purchase.purchaseNo} from ${supplier?.name ?? "supplier"}: ${items.length} item${items.length === 1 ? "" : "s"}, total ${npr(total)}`,
    next: { purchaseNo: purchase.purchaseNo, supplier: supplier?.name, items: items.length, total },
  });

  return purchase;
}

export async function updatePurchaseStatus(purchaseId: string, status: string) {
  const access = await assertPermission(status === "CANCELLED" ? "purchases.cancel" : "purchases.edit");
  const before = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { purchaseNo: true, status: true },
  });
  const purchase = await prisma.purchase.update({
    where: { id: purchaseId },
    data: { status },
    select: { id: true, status: true },
  });
  await logAudit({
    actor: access,
    action: status === "CANCELLED" ? "cancelled" : "status_changed",
    title: status === "CANCELLED" ? "Cancelled Purchase" : "Changed Purchase Status",
    module: "Purchases",
    entityType: "Purchase",
    entityId: purchaseId,
    description: `${before?.purchaseNo ?? "Purchase"}: status ${before?.status ?? "-"} -> ${status}`,
    previous: { status: before?.status },
    next: { status },
  });
  return purchase;
}

export async function recordPayment(
  purchaseId: string,
  amount: number,
  method: string,
  userId: string
) {
  const access = await assertPermission("purchases.edit");
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { total: true, paidAmount: true, purchaseNo: true },
  });

  if (!purchase) throw new Error("Purchase not found");

  const newPaidAmount = Number(purchase.paidAmount) + amount;

  if (newPaidAmount > Number(purchase.total)) {
    throw new Error("Payment exceeds purchase total");
  }

  // Create payment record (note: Payment model is for Sales, not Purchases)
  // This would need a PurchasePayment model if we want to track separate payments
  // For now, we just update the purchase paidAmount

  // Update purchase paid amount
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { paidAmount: new Decimal(newPaidAmount) },
  });
  await logAudit({
    actor: access,
    action: "payment",
    title: "Purchase Payment Made",
    module: "Purchases",
    entityType: "Purchase",
    entityId: purchaseId,
    description: `Paid ${npr(amount)} (${method.replace(/_/g, " ")}) on ${purchase.purchaseNo}. Paid ${npr(newPaidAmount)} of ${npr(Number(purchase.total))}`,
    previous: { paid: Number(purchase.paidAmount) },
    next: { paid: newPaidAmount },
  });

  return { newPaidAmount };
}

export async function receiveGoods(
  purchaseId: string,
  receivedItems: Array<{ itemId: string; receivedQuantity: number }>,
  userId: string
) {
  const access = await assertPermission("purchases.receive");
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      purchaseNo: true,
      items: {
        select: {
          id: true,
          productVariantId: true,
          quantityOrdered: true,
        },
      },
    },
  });

  if (!purchase) throw new Error("Purchase not found");

  // Create stock movements for received items
  for (const received of receivedItems) {
    const item = purchase.items.find((pi) => pi.id === received.itemId);
    if (!item) continue;

    if (received.receivedQuantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productVariantId: item.productVariantId,
          type: "PURCHASE",
          quantityChange: received.receivedQuantity,
          reason: `Purchase received`,
          referenceId: purchaseId,
          createdById: access.id,
        },
      });

      // Update variant quantity
      await prisma.productVariant.update({
        where: { id: item.productVariantId },
        data: {
          quantity: {
            increment: received.receivedQuantity,
          },
        },
      });
    }
  }

  // Update purchase status
  const allReceived = receivedItems.every(
    (ri) =>
      ri.receivedQuantity === purchase.items.find((pi) => pi.id === ri.itemId)?.quantityOrdered
  );

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
    },
  });

  const units = receivedItems.reduce((sum, r) => sum + (r.receivedQuantity > 0 ? r.receivedQuantity : 0), 0);
  await logAudit({
    actor: access,
    action: "received",
    title: allReceived ? "Purchase Received" : "Partial Purchase Received",
    module: "Purchases",
    entityType: "Purchase",
    entityId: purchaseId,
    description: `${allReceived ? "Received" : "Partially received"} ${purchase.purchaseNo}: ${units} unit${units === 1 ? "" : "s"} added to stock`,
    next: { status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED", units },
  });

  return { status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" };
}

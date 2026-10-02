"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getProductsForPOS(search?: string, categoryId?: string, brandId?: string) {
  const whereClause: any = {
    status: "ACTIVE",
    variants: {
      some: {
        quantity: { gt: 0 },
        status: "ACTIVE",
      },
    },
  };

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  if (brandId) {
    whereClause.brandId = brandId;
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      variants: {
        where: { quantity: { gt: 0 }, status: "ACTIVE" },
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          quantity: true,
          sellingPrice: true,
          purchasePrice: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      sellingPrice: Number(v.sellingPrice),
      purchasePrice: Number(v.purchasePrice),
    })),
  }));

  // Get categories and brands for filters
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { products: { some: { status: "ACTIVE" } } },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { products: { some: { status: "ACTIVE" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return { products: serialized, categories, brands };
}

export async function getCustomers(search?: string) {
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      credits: { select: { amount: true, amountPaid: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return customers.map((c) => ({
    ...c,
    outstanding: c.credits.reduce((sum, cr) => sum + (Number(cr.amount) - Number(cr.amountPaid)), 0),
  }));
}

export async function searchCustomersByNameOrPhone(query: string) {
  if (!query.trim()) return [];

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      email: true,
      credits: { select: { amount: true, amountPaid: true } },
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    address: c.address || "",
    email: c.email || "",
    outstanding: c.credits.reduce((sum, cr) => sum + (Number(cr.amount) - Number(cr.amountPaid)), 0),
  }));
}

export async function createSale(
  customerId: string | null,
  staffId: string,
  items: Array<{ variantId: string; quantity: number; unitPrice: string; unitCost: string; discount: number }>,
  subtotal: number,
  discount: number,
  tax: number,
  payments: Array<{ method: string; amount: number }> | string,
  amountPaid: number,
  dueDate?: Date,
  deliveryMethod: string = "IN_SHOP",
  deliveryAddress?: string,
  deliveryPhone?: string
) {
  // Generate invoice number
  const lastSale = await prisma.sale.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNo: true },
  });

  const lastNum = lastSale?.invoiceNo
    ? parseInt(lastSale.invoiceNo.replace("INV-", ""))
    : 0;
  const newInvoiceNo = `INV-${String(lastNum + 1).padStart(6, "0")}`;

  // Calculate total
  const total = subtotal - discount + tax;

  // Normalize payments array
  const paymentsList: Array<{ method: string; amount: number }> = Array.isArray(payments)
    ? payments
    : [{ method: payments as string, amount: amountPaid }];

  // Determine if credit sale
  const isCreditSale = paymentsList.some((p) => p.method === "CREDIT");

  // Create sale with items
  const sale = await prisma.sale.create({
    data: {
      invoiceNo: newInvoiceNo,
      customerId: customerId || null,
      staffId,
      subtotal: new Decimal(subtotal),
      discount: new Decimal(discount),
      tax: new Decimal(tax),
      total: new Decimal(total),
      amountPaid: new Decimal(amountPaid),
      deliveryMethod: deliveryMethod as any,
      deliveryAddress: deliveryAddress || null,
      deliveryPhone: deliveryPhone || null,
      status: deliveryMethod === "COD" ? "PENDING" : "COMPLETED",
      items: {
        create: items.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPrice: new Decimal(item.unitPrice),
          unitCost: new Decimal(item.unitCost),
          discount: new Decimal(item.discount),
          total: new Decimal(Number(item.unitPrice) * item.quantity - item.discount),
        })),
      },
    },
    select: { id: true, invoiceNo: true },
  });

  // Create invoice
  await prisma.invoice.create({
    data: {
      saleId: sale.id,
      invoiceNo: newInvoiceNo,
      issuedAt: new Date(),
    },
  });

  // Create payment records for each payment method
  for (const payment of paymentsList) {
    await prisma.payment.create({
      data: {
        saleId: sale.id,
        method: payment.method as any,
        amount: new Decimal(payment.amount),
      },
    });
  }

  // Create stock movements and reduce inventory
  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { quantity: true },
    });

    if (!variant || variant.quantity < item.quantity) {
      throw new Error("Insufficient stock");
    }

    // Create stock movement
    await prisma.stockMovement.create({
      data: {
        productVariantId: item.variantId,
        type: "SALE",
        quantityChange: -item.quantity,
        reason: `Sale ${newInvoiceNo}`,
        referenceId: sale.id,
        createdById: staffId,
      },
    });

    // Reduce inventory
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: {
        quantity: { decrement: item.quantity },
      },
    });
  }

  // If credit sale, create customer credit record
  if (isCreditSale && customerId) {
    const outstandingAmount = total - amountPaid;
    if (outstandingAmount > 0) {
      await prisma.customerCredit.create({
        data: {
          customerId,
          invoiceRef: newInvoiceNo,
          amount: new Decimal(outstandingAmount),
          dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        },
      });
    }
  }

  return { id: sale.id, invoiceNo: newInvoiceNo };
}

export async function getSalesHistory(search?: string, customerId?: string, paymentMethod?: string, page = 1) {
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { invoiceNo: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (customerId) {
    whereClause.customerId = customerId;
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    select: {
      id: true,
      invoiceNo: true,
      total: true,
      amountPaid: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      staff: { select: { name: true } },
      payments: { select: { method: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * 50,
    take: 50,
  });

  // Filter by payment method on client if needed
  const filtered = paymentMethod
    ? sales.filter((s) => s.payments.some((p) => p.method === paymentMethod))
    : sales;

  return filtered.map((s) => ({
    ...s,
    total: Number(s.total),
    amountPaid: Number(s.amountPaid),
    outstanding: Number(s.total) - Number(s.amountPaid),
    paymentMethods: s.payments.map((p) => p.method).join(", "),
    itemCount: s.items.length,
  }));
}

export async function getSaleDetails(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      invoiceNo: true,
      total: true,
      discount: true,
      tax: true,
      subtotal: true,
      amountPaid: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
      staff: { select: { name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          total: true,
          unitCost: true,
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
          method: true,
          amount: true,
          createdAt: true,
        },
      },
      returns: {
        select: {
          id: true,
          type: true,
          quantity: true,
          reason: true,
          refundAmount: true,
        },
      },
    },
  });

  if (!sale) throw new Error("Sale not found");

  // Calculate profit
  const profit = sale.items.reduce(
    (sum, item) => sum + (Number(item.unitPrice) - Number(item.unitCost)) * item.quantity - item.discount,
    0
  );

  return {
    sale: {
      ...sale,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        unitCost: Number(item.unitCost),
      })),
      payments: sale.payments,
      returns: sale.returns,
    },
    outstanding: Number(sale.total) - Number(sale.amountPaid),
    profit,
  };
}

export async function processSaleReturn(
  saleId: string,
  type: "RETURN" | "EXCHANGE",
  itemId: string,
  quantity: number,
  reason: string,
  refundMethod: string,
  newVariantId?: string,
  priceDifference?: number
) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      invoiceNo: true,
      items: { select: { id: true, productVariantId: true, unitPrice: true, quantity: true, unitCost: true } },
    },
  });

  if (!sale) throw new Error("Sale not found");

  const saleItem = sale.items.find((i) => i.id === itemId);
  if (!saleItem || quantity > saleItem.quantity) {
    throw new Error("Invalid return quantity");
  }

  const refundAmount = Number(saleItem.unitPrice) * quantity - (Number(saleItem.unitCost) * quantity);

  // Create return record
  const returnRecord = await prisma.saleReturn.create({
    data: {
      saleId,
      type,
      quantity,
      reason,
      refundAmount: new Decimal(Math.abs(refundAmount)),
      storeCredit: refundMethod === "STORE_CREDIT",
    },
    select: { id: true },
  });

  // Restore inventory for returned item
  await prisma.stockMovement.create({
    data: {
      productVariantId: saleItem.productVariantId,
      type: "CUSTOMER_RETURN",
      quantityChange: quantity,
      reason: `Return from ${sale.invoiceNo}`,
      referenceId: saleId,
      createdById: "system", // Should be actual user ID
    },
  });

  await prisma.productVariant.update({
    where: { id: saleItem.productVariantId },
    data: { quantity: { increment: quantity } },
  });

  // Handle exchange
  if (type === "EXCHANGE" && newVariantId && priceDifference !== undefined) {
    // Reduce new variant inventory
    await prisma.productVariant.update({
      where: { id: newVariantId },
      data: { quantity: { decrement: quantity } },
    });

    // Create stock movement for new variant
    await prisma.stockMovement.create({
      data: {
        productVariantId: newVariantId,
        type: "SALE",
        quantityChange: -quantity,
        reason: `Exchange for ${sale.invoiceNo}`,
        referenceId: saleId,
        createdById: "system",
      },
    });

    // If there's additional payment, create a payment record
    if (priceDifference > 0) {
      await prisma.payment.create({
        data: {
          saleId,
          method: "CASH", // Or get from parameter
          amount: new Decimal(priceDifference),
        },
      });

      // Update sale amount paid
      const currentSale = await prisma.sale.findUnique({
        where: { id: saleId },
        select: { amountPaid: true },
      });

      if (currentSale) {
        await prisma.sale.update({
          where: { id: saleId },
          data: { amountPaid: new Decimal(Number(currentSale.amountPaid) + priceDifference) },
        });
      }
    } else if (priceDifference < 0) {
      // Refund difference
      // This would typically create a refund payment or adjust sale
    }
  }

  return { returnId: returnRecord.id, refundAmount: Math.abs(refundAmount) };
}

export async function recordAdditionalPayment(saleId: string, amount: number, method: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { total: true, amountPaid: true },
  });

  if (!sale) throw new Error("Sale not found");

  const newAmountPaid = Number(sale.amountPaid) + amount;

  if (newAmountPaid > Number(sale.total)) {
    throw new Error("Payment exceeds sale total");
  }

  // Create payment record
  await prisma.payment.create({
    data: {
      saleId,
      method: method as any,
      amount: new Decimal(amount),
    },
  });

  // Update sale amount paid
  await prisma.sale.update({
    where: { id: saleId },
    data: { amountPaid: new Decimal(newAmountPaid) },
  });

  // If now fully paid and was credit, mark as paid
  if (newAmountPaid >= Number(sale.total)) {
    // Find and update related customer credit
    const saleData = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { invoiceNo: true },
    });

    if (saleData) {
      await prisma.customerCredit.updateMany({
        where: { invoiceRef: saleData.invoiceNo },
        data: { amountPaid: new Decimal(Number(sale.total)) },
      });
    }
  }

  return { newAmountPaid };
}

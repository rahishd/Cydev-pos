"use server";

import { assertPermission } from "@/lib/access";
import { logAudit, npr } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { formatNumber } from "@/lib/settings-schema";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoiceToken } from "@/lib/invoice-link";
import { Decimal } from "@prisma/client/runtime/library";
import { evaluatePromo, normalizeCode, toPromoLike } from "@/lib/promo";

export async function getProductsForPOS(search?: string, categoryId?: string, brandId?: string) {
  await assertPermission("sales.create");
  const posSettings = await getSettings();
  const whereClause: any = {
    status: "ACTIVE",
    variants: {
      some: {
        ...(posSettings.sales.allowOutOfStockSales ? {} : { quantity: { gt: 0 } }),
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
  await assertPermission("sales.create");
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
  await assertPermission("sales.create");
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
  deliveryPhone?: string,
  customerName?: string,
  customerPhone?: string,
  promoCode?: string
) {
  const access = await assertPermission("sales.create");
  if ((discount > 0 || items.some((i) => i.discount > 0)) && !access.can("sales.discount")) {
    throw new Error("You don't have permission to apply discounts. Please ask the Owner.");
  }
  staffId = access.id;

  const settings = await getSettings();
  const methodLabels: Record<string, [string, boolean]> = {
    CASH: ["Cash", Boolean(settings.payments.cash)],
    ESEWA: ["eSewa", Boolean(settings.payments.esewa)],
    KHALTI: ["Khalti", Boolean(settings.payments.khalti)],
    FONEPAY: ["Fonepay", Boolean(settings.payments.fonepay)],
    CARD: ["Card", Boolean(settings.payments.card)],
    BANK_TRANSFER: ["Bank Transfer", Boolean(settings.payments.bankTransfer)],
    CREDIT: ["Credit", Boolean(settings.payments.credit)],
  };
  const usedMethods = Array.isArray(payments) ? payments.map((p) => p.method) : [payments as string];
  for (const m of usedMethods) {
    const entry = methodLabels[m];
    if (entry && !entry[1]) throw new Error(`${entry[0]} payments are turned off in Settings.`);
  }

  const usesCredit = usedMethods.includes("CREDIT");
  if (usesCredit) {
    if (!settings.customers.creditEnabled) throw new Error("Customer credit is turned off in Settings.");
    if (settings.sales.requireCustomerForCredit && !customerId && !customerName?.trim() && !customerPhone?.trim()) {
      throw new Error("Please enter the customer's name or phone for a credit sale.");
    }
  }

  const itemDiscounts = items.reduce((sum, i) => sum + (i.discount || 0), 0);
  const totalDiscount = discount + itemDiscounts;
  if (totalDiscount > 0) {
    if (!settings.sales.allowDiscounts) throw new Error("Discounts are turned off in Settings.");
    if (!access.isOwner) {
      const gross = subtotal + itemDiscounts;
      const percent = gross > 0 ? (totalDiscount / gross) * 100 : 0;
      const limit = Number(settings.sales.maxStaffDiscountPercent);
      if (percent > limit + 0.001) {
        throw new Error(
          `A ${percent.toFixed(1)}% discount is above the staff limit of ${limit}%. Please ask the Owner to complete this sale.`
        );
      }
    }
  }

  // A promo code takes its discount off the bill. It is checked again here, so the browser can't invent one.
  let promoApplied: { id: string; code: string; discount: number } | null = null;
  if (promoCode?.trim()) {
    if (!access.can("sales.promo")) throw new Error("You don't have permission to apply promo codes.");
    if (!settings.sales.allowDiscounts) throw new Error("Discounts are turned off in Settings.");
    const found = await prisma.promoCode.findUnique({ where: { code: normalizeCode(promoCode) } });
    const billAmount = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity - (i.discount || 0), 0) - discount;
    const check = evaluatePromo(found ? toPromoLike(found) : null, billAmount);
    if (!check.ok || !found) throw new Error(check.ok ? "That promo code isn't valid." : check.message);
    promoApplied = { id: found.id, code: found.code, discount: check.discount };
    discount += check.discount;
  }

  if (!settings.inventory.allowNegativeStock) {
    for (const item of items) {
      const v = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        select: { quantity: true, sku: true },
      });
      if (!v) throw new Error("A product in the cart no longer exists.");
      if (v.quantity < item.quantity) {
        throw new Error(`Not enough stock for ${v.sku}: only ${v.quantity} left.`);
      }
    }
  }

  // Resolve customer: use given id, else match by phone/name, else create
  if (!customerId && (customerName?.trim() || customerPhone?.trim())) {
    const name = customerName?.trim() || "";
    const phone = customerPhone?.trim() || "";
    let existing = phone
      ? await prisma.customer.findFirst({ where: { phone } })
      : await prisma.customer.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
    if (!existing) {
      existing = await prisma.customer.create({
        data: {
          name: name || phone,
          phone: phone || null,
          address: deliveryAddress || null,
        },
      });
    }
    customerId = existing.id;
  }

  if (usesCredit && customerId && Number(settings.customers.maxCreditAmount) > 0) {
    const open = await prisma.customerCredit.aggregate({
      where: { customerId },
      _sum: { amount: true, amountPaid: true },
    });
    const already = Number(open._sum.amount ?? 0) - Number(open._sum.amountPaid ?? 0);
    const adding = Math.max(0, subtotal - discount + tax - amountPaid);
    const limit = Number(settings.customers.maxCreditAmount);
    if (already + adding > limit) {
      throw new Error(
        `This would take the customer's credit to NPR ${(already + adding).toLocaleString("en-US")}, above the limit of NPR ${limit.toLocaleString("en-US")}.`
      );
    }
  }

  // Generate invoice number
  const lastSale = await prisma.sale.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNo: true },
  });

  const lastNum = parseInt(/(\d+)$/.exec(lastSale?.invoiceNo ?? "")?.[1] ?? "0", 10) || 0;
  const newInvoiceNo = formatNumber(
    String(settings.invoice.prefix ?? "INV-"),
    Math.max(lastNum + 1, Number(settings.invoice.startingNumber) || 1),
    Number(settings.invoice.numberDigits) || 6
  );

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
      promoCode: promoApplied?.code ?? null,
      promoDiscount: new Decimal(promoApplied?.discount ?? 0),
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

  if (promoApplied) {
    await prisma.promoCode.update({ where: { id: promoApplied.id }, data: { usedCount: { increment: 1 } } });
  }

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

    if (!variant) throw new Error("A product in the cart no longer exists.");

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
          dueDate: dueDate || new Date(Date.now() + (Number(settings.customers.creditDueDays) || 30) * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const variantRows = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    select: { id: true, size: true, color: true, product: { select: { name: true } } },
  });
  const itemSummary = items
    .slice(0, 4)
    .map((i) => {
      const v = variantRows.find((r) => r.id === i.variantId);
      const opt = [v?.size, v?.color].filter(Boolean).join("/");
      return `${v?.product.name ?? "Item"}${opt ? " (" + opt + ")" : ""} x${i.quantity}`;
    })
    .join(", ");
  await logAudit({
    actor: access,
    action: "created",
    title: "Sale Completed",
    module: "Sales",
    entityType: "Sale",
    entityId: sale.id,
    description:
      `Invoice ${newInvoiceNo}: ${npr(total)} paid by ${[...new Set(usedMethods)].map((m) => m.replace(/_/g, " ")).join(" + ")}, ` +
      `${customerId ? "registered customer" : "walk-in"}` +
      (totalDiscount > 0 ? `, discount ${npr(totalDiscount)}` : "") +
      (promoApplied ? `, promo ${promoApplied.code} -${npr(promoApplied.discount)}` : "") +
      (total - amountPaid > 0.001 ? `, due ${npr(total - amountPaid)}` : "") +
      `. Items: ${itemSummary}${items.length > 4 ? ", ..." : ""}`,
    next: {
      invoiceNo: newInvoiceNo,
      total,
      paid: amountPaid,
      discount: totalDiscount,
      payment: usedMethods,
      items: items.length,
    },
  });

  return { id: sale.id, invoiceNo: newInvoiceNo };
}

export async function getSalesHistory(search?: string, customerId?: string, paymentMethod?: string, page = 1) {
  await assertPermission("sales.history");
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

/** Units already sent back for each line of a sale. Returns saved before lines were tracked count against the only line of a one-item sale. */
function returnedByItem(items: Array<{ id: string }>, returns: Array<{ saleItemId: string | null; quantity: number }>) {
  const map = new Map<string, number>();
  for (const r of returns) {
    const id = r.saleItemId ?? (items.length === 1 ? items[0].id : null);
    if (id) map.set(id, (map.get(id) ?? 0) + r.quantity);
  }
  return map;
}

/** What the customer actually paid for these units: the line's price after its own discount, less its share of any whole-bill discount, plus its share of tax. */
function refundFor(
  sale: { discount: unknown; total: unknown },
  items: Array<{ total: unknown }>,
  item: { total: unknown; quantity: number },
  qty: number
) {
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.total), 0);
  const billDiscount = Number(sale.discount);
  const share = itemsTotal > 0 ? Number(item.total) / itemsTotal : 0;
  const paid = Number(item.total) - billDiscount * share;
  const taxFactor = itemsTotal - billDiscount > 0 ? Number(sale.total) / (itemsTotal - billDiscount) : 1;
  return Math.round(((paid * taxFactor) / item.quantity) * qty * 100) / 100;
}

export async function getSaleDetails(saleId: string) {
  const access = await assertPermission("sales.history");
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
      customer: { select: { id: true, name: true, phone: true, address: true } },
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
          saleItemId: true,
        },
      },
    },
  });

  if (!sale) throw new Error("Sale not found");

  const returned = returnedByItem(sale.items, sale.returns);

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
        returnedQty: returned.get(item.id) ?? 0,
        refundPerUnit: refundFor(sale, sale.items, item, 1),
      })),
      payments: sale.payments,
      returns: sale.returns.map((r) => ({ ...r, refundAmount: Number(r.refundAmount) })),
    },
    outstanding: Number(sale.total) - Number(sale.amountPaid),
    profit: access.can("reports.gross_profit") ? profit : undefined,
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
  const access = await assertPermission(type === "EXCHANGE" ? "sales.exchange" : "sales.return");
  const returnRules = (await getSettings()).returns;
  if (type === "RETURN" && !returnRules.returnsEnabled) throw new Error("Returns are turned off in Settings.");
  if (type === "EXCHANGE" && !returnRules.exchangeEnabled) throw new Error("Exchanges are turned off in Settings.");
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      invoiceNo: true,
      createdAt: true,
      discount: true,
      total: true,
      items: { select: { id: true, productVariantId: true, unitPrice: true, quantity: true, unitCost: true, total: true } },
    },
  });

  if (!sale) throw new Error("Sale not found");

  const windowDays = Number(returnRules.returnWindowDays);
  if (windowDays > 0 && !access.isOwner) {
    const ageDays = (Date.now() - sale.createdAt.getTime()) / 86400000;
    if (ageDays > windowDays) {
      throw new Error(`This sale is older than the ${windowDays}-day return period. Only the Owner can accept it.`);
    }
  }

  const saleItem = sale.items.find((i) => i.id === itemId);
  if (!saleItem) throw new Error("That item isn't on this invoice.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Enter a quantity of at least 1.");

  const refundAmount = refundFor(sale, sale.items, saleItem, quantity);
  const refunded = type === "RETURN" || (priceDifference ?? 0) < 0;

  // The check and the save happen together, so two clicks at once can't return the same units twice.
  let returnRecord: { id: string };
  try {
    returnRecord = await prisma.$transaction(
      async (tx) => {
        const earlier = await tx.saleReturn.findMany({ where: { saleId }, select: { saleItemId: true, quantity: true } });
        const already = returnedByItem(sale.items, earlier).get(saleItem.id) ?? 0;
        const left = saleItem.quantity - already;
        if (quantity > left) {
          throw new Error(
            left <= 0
              ? `All ${saleItem.quantity} of this item on ${sale.invoiceNo} have already been returned.`
              : `Only ${left} of this item can still be returned on ${sale.invoiceNo} (${already} already returned).`
          );
        }
        return tx.saleReturn.create({
          data: {
            saleId,
            saleItemId: saleItem.id,
            type,
            quantity,
            reason,
            refundAmount: new Decimal(Math.abs(refundAmount)),
            returnedCost: new Decimal(returnRules.autoRestock ? Number(saleItem.unitCost) * quantity : 0),
            storeCredit: refundMethod === "STORE_CREDIT",
            refunded,
            refundMethod,
            newVariantId: type === "EXCHANGE" ? newVariantId || null : null,
            priceDifference: type === "EXCHANGE" && priceDifference !== undefined ? new Decimal(priceDifference) : null,
          },
          select: { id: true },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e) {
    if ((e as { code?: string }).code === "P2034") throw new Error("Another return was being saved at the same moment. Please check the invoice and try again.");
    throw e;
  }

  // Restore inventory for returned item (unless the shop wants returns checked before restocking)
  if (returnRules.autoRestock) {
    await prisma.stockMovement.create({
      data: {
        productVariantId: saleItem.productVariantId,
        type: "CUSTOMER_RETURN",
        quantityChange: quantity,
        reason: `Return from ${sale.invoiceNo}`,
        referenceId: saleId,
        createdById: access.id,
      },
    });

    await prisma.productVariant.update({
      where: { id: saleItem.productVariantId },
      data: { quantity: { increment: quantity } },
    });
  }

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
        createdById: access.id,
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

  {
    const [oldV, newV] = await Promise.all([
      prisma.productVariant.findUnique({
        where: { id: saleItem.productVariantId },
        select: { size: true, color: true, product: { select: { name: true } } },
      }),
      newVariantId
        ? prisma.productVariant.findUnique({
            where: { id: newVariantId },
            select: { size: true, color: true, product: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    const label = (v: typeof oldV) =>
      v ? `${v.product.name}${[v.size, v.color].filter(Boolean).length ? " (" + [v.size, v.color].filter(Boolean).join("/") + ")" : ""}` : "item";
    await logAudit({
      actor: access,
      action: type === "EXCHANGE" ? "exchange" : "return",
      title: type === "EXCHANGE" ? "Product Exchanged" : "Sale Returned",
      module: "Sales",
      entityType: "SaleReturn",
      entityId: returnRecord.id,
      description:
        type === "EXCHANGE"
          ? `${sale.invoiceNo}: returned ${label(oldV)} x${quantity}, given ${label(newV)}. Difference ${npr(priceDifference ?? 0)}`
          : `${sale.invoiceNo}: returned ${label(oldV)} x${quantity}, refund ${npr(Math.abs(refundAmount))} (${refundMethod.replace(/_/g, " ")})${reason?.trim() ? ". Reason: " + reason.trim() : ""}`,
      next: { invoiceNo: sale.invoiceNo, type, quantity, refund: Math.abs(refundAmount), restocked: returnRules.autoRestock },
    });
  }

  return { returnId: returnRecord.id, refundAmount: Math.abs(refundAmount) };
}

export async function recordAdditionalPayment(saleId: string, amount: number, method: string) {
  const access = await assertPermission("sales.create", "customers.credit");
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { total: true, amountPaid: true, invoiceNo: true },
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

  await logAudit({
    actor: access,
    action: "payment",
    title: "Payment Received",
    module: "Sales",
    entityType: "Sale",
    entityId: saleId,
    description: `${sale.invoiceNo}: received ${npr(amount)} (${method.replace(/_/g, " ")}). Paid ${npr(newAmountPaid)} of ${npr(Number(sale.total))}`,
    previous: { paid: Number(sale.amountPaid) },
    next: { paid: newAmountPaid },
  });

  return { newAmountPaid };
}

export async function getInvoiceShareUrl(saleId: string) {
  const invoiceSettings = (await getSettings()).invoice;
  if (!invoiceSettings.enablePdf) throw new Error("PDF invoices are turned off in Settings.");
  const access = await assertPermission("sales.share");
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const shared = await prisma.sale.findUnique({ where: { id: saleId }, select: { invoiceNo: true } });
  await logAudit({
    actor: access,
    action: "invoice_shared",
    title: "Invoice Shared",
    module: "Sales",
    entityType: "Invoice",
    entityId: saleId,
    description: `Shared invoice ${shared?.invoiceNo ?? ""} by link`,
  });

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  return `${origin}/api/invoice/${saleId}?t=${invoiceToken(saleId)}`;
}

/** Checks a promo code against the current bill so the checkout can show the discount before the sale is saved. */
export async function checkPromoCode(code: string, billAmount: number) {
  await assertPermission("sales.promo");
  if (!(await getSettings()).sales.allowDiscounts) return { ok: false as const, message: "Discounts are turned off in Settings." };
  const found = await prisma.promoCode.findUnique({ where: { code: normalizeCode(code) } });
  const check = evaluatePromo(found ? toPromoLike(found) : null, billAmount);
  return check.ok ? { ok: true as const, code: found!.code, discount: check.discount, label: check.label } : check;
}

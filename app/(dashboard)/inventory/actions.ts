"use server";

import { assertPermission } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function getInventoryPageData(
  search?: string,
  categoryId?: string,
  brandId?: string,
  stockStatus?: "all" | "low" | "out"
) {
  await assertPermission("inventory.view");
  const whereClause: any = {
    product: { status: "ACTIVE" },
  };

  if (search) {
    whereClause.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { sku: { contains: search, mode: "insensitive" } },
      { size: { contains: search, mode: "insensitive" } },
      { color: { contains: search, mode: "insensitive" } },
      { product: { brand: { name: { contains: search, mode: "insensitive" } } } },
      { product: { category: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (categoryId) {
    whereClause.product.categoryId = categoryId;
  }

  if (brandId) {
    whereClause.product.brandId = brandId;
  }

  // Fetch variants
  const variants = await prisma.productVariant.findMany({
    where: whereClause,
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      quantity: true,
      minStockLevel: true,
      purchasePrice: true,
      sellingPrice: true,
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          brandId: true,
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
      },
    },
    orderBy: { product: { name: "asc" } },
  });

  // Apply stock status filter
  let filteredVariants = variants;
  if (stockStatus === "low") {
    filteredVariants = variants.filter(
      (v) => v.quantity > 0 && v.quantity <= v.minStockLevel
    );
  } else if (stockStatus === "out") {
    filteredVariants = variants.filter((v) => v.quantity === 0);
  }

  // Calculate KPIs from all variants (not filtered)
  const totalStock = variants.reduce((sum, v) => sum + v.quantity, 0);
  const lowStockCount = variants.filter(
    (v) => v.quantity > 0 && v.quantity <= v.minStockLevel
  ).length;
  const outOfStockCount = variants.filter((v) => v.quantity === 0).length;
  const inventoryValue = variants.reduce(
    (sum, v) => sum + v.quantity * Number(v.purchasePrice),
    0
  );

  // Serialize Decimal values for client
  const serializedVariants = filteredVariants.map((v) => ({
    ...v,
    purchasePrice: Number(v.purchasePrice),
    sellingPrice: Number(v.sellingPrice),
  }));

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    variants: serializedVariants,
    kpi: {
      totalStock,
      lowStockCount,
      outOfStockCount,
      inventoryValue,
    },
    categories,
    brands,
    filters: {
      search,
      categoryId,
      brandId,
      stockStatus,
    },
  };
}

export async function getVariantDetails(variantId: string) {
  await assertPermission("inventory.view");
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      quantity: true,
      minStockLevel: true,
      purchasePrice: true,
      sellingPrice: true,
      product: { select: { name: true } },
    },
  });

  if (!variant) throw new Error("Variant not found");

  const movements = await prisma.stockMovement.findMany({
    where: { productVariantId: variantId },
    select: {
      type: true,
      quantityChange: true,
    },
  });

  const stockSummary = {
    openingStock: 0,
    purchased: 0,
    sold: 0,
    customerReturns: 0,
    supplierReturns: 0,
    damaged: 0,
    loss: 0,
    manualAdjustment: 0,
  };

  movements.forEach((m) => {
    if (m.type === "OPENING_STOCK") stockSummary.openingStock += m.quantityChange;
    if (m.type === "PURCHASE") stockSummary.purchased += m.quantityChange;
    if (m.type === "SALE") stockSummary.sold += Math.abs(m.quantityChange);
    if (m.type === "CUSTOMER_RETURN") stockSummary.customerReturns += m.quantityChange;
    if (m.type === "SUPPLIER_RETURN") stockSummary.supplierReturns += Math.abs(m.quantityChange);
    if (m.type === "DAMAGE") stockSummary.damaged += Math.abs(m.quantityChange);
    if (m.type === "LOSS") stockSummary.loss += Math.abs(m.quantityChange);
    if (m.type === "MANUAL_ADJUSTMENT") stockSummary.manualAdjustment += m.quantityChange;
  });

  const inventoryValue = variant.quantity * Number(variant.purchasePrice);

  // Serialize Decimal values for client
  const serializedVariant = {
    ...variant,
    purchasePrice: Number(variant.purchasePrice),
    sellingPrice: Number(variant.sellingPrice),
  };

  return {
    variant: serializedVariant,
    stockSummary,
    inventoryValue,
  };
}

export async function getStockMovements(
  variantId?: string,
  limit: number = 50
) {
  await assertPermission("inventory.history");
  const movements = await prisma.stockMovement.findMany({
    where: variantId ? { productVariantId: variantId } : undefined,
    select: {
      id: true,
      type: true,
      quantityChange: true,
      reason: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      productVariant: {
        select: {
          sku: true,
          size: true,
          color: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return movements;
}

export async function createStockMovement(
  variantId: string,
  type: string,
  quantity: number,
  reason: string,
  _clientUserId?: string
) {
  const adjusting =
    quantity < 0 || ["ADJUSTMENT", "DAMAGE", "LOSS", "MANUAL_ADJUSTMENT", "SUPPLIER_RETURN"].includes(type);
  const access = await assertPermission(adjusting ? "inventory.adjust" : "inventory.add_stock");
  const userId = access.id;
  const stockRules = (await getSettings()).inventory;
  if (adjusting && stockRules.requireAdjustmentReason && !reason?.trim()) {
    throw new Error("Please enter a reason for this stock adjustment.");
  }
  if (type === "DAMAGE" && !stockRules.allowDamaged) throw new Error("Damaged stock entries are turned off in Settings.");
  if (type === "LOSS" && !stockRules.allowLost) throw new Error("Lost stock entries are turned off in Settings.");

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { name: true } } },
  });

  if (!variant) throw new Error("Variant not found");

  if (variant.quantity + quantity < 0 && !stockRules.allowNegativeStock) {
    throw new Error("Insufficient stock");
  }

  const movement = await prisma.stockMovement.create({
    data: {
      productVariantId: variantId,
      type,
      quantityChange: quantity,
      reason,
      createdById: userId,
    },
  });

  // Update variant quantity
  const newQuantity = variant.quantity + quantity;
  if (newQuantity < 0 && !stockRules.allowNegativeStock) throw new Error("Insufficient stock");

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { quantity: newQuantity },
  });

  const variantLabel = [variant.size, variant.color].filter(Boolean).join(" / ") || variant.sku;
  await logAudit({
    actor: access,
    action: adjusting ? "adjustment" : "created",
    title: adjusting
      ? type === "DAMAGE"
        ? "Damaged Stock"
        : type === "LOSS"
          ? "Lost Stock"
          : "Stock Adjustment"
      : "Stock Added",
    module: "Inventory",
    entityType: "StockMovement",
    entityId: variantId,
    description: `${variant.product.name} (${variantLabel}): ${variant.quantity} -> ${newQuantity} (${quantity > 0 ? "+" : ""}${quantity})${reason?.trim() ? ". Reason: " + reason.trim() : ""}`,
    previous: { stock: variant.quantity },
    next: { stock: newQuantity, change: quantity, type, reason: reason?.trim() || null },
  });

  return movement;
}

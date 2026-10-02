"use server";

import { prisma } from "@/lib/prisma";

export async function getInventoryPageData(
  search?: string,
  categoryId?: string,
  brandId?: string,
  stockStatus?: "all" | "low" | "out"
) {
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
  userId: string
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) throw new Error("Variant not found");

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
  if (newQuantity < 0) throw new Error("Insufficient stock");

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { quantity: newQuantity },
  });

  return movement;
}

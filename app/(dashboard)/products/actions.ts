"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function getProductsPageData() {
  const [products, categories, brands, suppliers] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { variants: true } },
        variants: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            material: true,
            purchasePrice: true,
            sellingPrice: true,
            quantity: true,
            minStockLevel: true,
            status: true,
          },
          orderBy: { sku: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeCount = products.filter((p) => p.status === "ACTIVE").length;
  const inactiveCount = products.filter((p) => p.status === "INACTIVE").length;

  return {
    products,
    categories,
    brands,
    suppliers,
    stats: {
      total: products.length,
      active: activeCount,
      inactive: inactiveCount,
      categories: categories.length,
      brands: brands.length,
    },
  };
}

export type ProductsPageData = Awaited<ReturnType<typeof getProductsPageData>>;
export type ProductWithRelations = ProductsPageData["products"][number];

export interface VariantInput {
  id?: string;
  size?: string;
  color?: string;
  material?: string;
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number;
}

export interface ProductInput {
  name: string;
  sku: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  discountPrice?: number;
  minStockLevel: number;
  status: "ACTIVE" | "INACTIVE";
  imageUrl?: string;
  variants: VariantInput[];
}

export async function createProduct(input: ProductInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id;

  const variants =
    input.variants.length > 0
      ? input.variants
      : [
          {
            sku: `${input.sku}-001`,
            purchasePrice: input.purchasePrice,
            sellingPrice: input.sellingPrice,
            quantity: 0,
            minStockLevel: input.minStockLevel,
          },
        ];

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        sku: input.sku,
        categoryId: input.categoryId || null,
        brandId: input.brandId || null,
        supplierId: input.supplierId || null,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        discountPrice: input.discountPrice ?? null,
        minStockLevel: input.minStockLevel,
        status: input.status,
      },
    });

    for (const v of variants) {
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          size: v.size || null,
          color: v.color || null,
          material: v.material || null,
          purchasePrice: v.purchasePrice,
          sellingPrice: v.sellingPrice,
          quantity: v.quantity,
          minStockLevel: v.minStockLevel,
          status: "ACTIVE",
        },
      });

      if (v.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            productVariantId: variant.id,
            type: "OPENING_STOCK",
            quantityChange: v.quantity,
            reason: "Opening stock",
            createdById: userId,
          },
        });
      }
    }
  });

  revalidatePath("/products");
}

export async function updateProduct(
  id: string,
  input: ProductInput & { variants: (VariantInput & { delete?: boolean })[] }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        sku: input.sku,
        categoryId: input.categoryId || null,
        brandId: input.brandId || null,
        supplierId: input.supplierId || null,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        discountPrice: input.discountPrice ?? null,
        minStockLevel: input.minStockLevel,
        status: input.status,
      },
    });

    for (const v of input.variants) {
      if (v.id && v.delete) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: { status: "INACTIVE" },
        });
      } else if (v.id) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: {
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            purchasePrice: v.purchasePrice,
            sellingPrice: v.sellingPrice,
            minStockLevel: v.minStockLevel,
          },
        });
      } else {
        const variant = await tx.productVariant.create({
          data: {
            productId: id,
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            purchasePrice: v.purchasePrice,
            sellingPrice: v.sellingPrice,
            quantity: v.quantity,
            minStockLevel: v.minStockLevel,
            status: "ACTIVE",
          },
        });

        if (v.quantity > 0) {
          await tx.stockMovement.create({
            data: {
              productVariantId: variant.id,
              type: "OPENING_STOCK",
              quantityChange: v.quantity,
              reason: "Opening stock",
              createdById: userId,
            },
          });
        }
      }
    }
  });

  revalidatePath("/products");
}

export async function toggleProductStatus(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!product) throw new Error("Product not found");

  await prisma.product.update({
    where: { id },
    data: { status: product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  const hasSales = await prisma.saleItem.count({
    where: { productVariant: { productId: id } },
  });
  if (hasSales > 0) {
    throw new Error("Cannot delete a product that has sales history. Deactivate it instead.");
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
}

export async function createCategory(name: string) {
  const category = await prisma.category.create({ data: { name: name.trim() } });
  revalidatePath("/products");
  return category;
}

export async function createBrand(name: string) {
  const brand = await prisma.brand.create({ data: { name: name.trim() } });
  revalidatePath("/products");
  return brand;
}

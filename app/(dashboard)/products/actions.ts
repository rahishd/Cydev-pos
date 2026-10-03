"use server";

import { assertPermission } from "@/lib/access";
import { logAudit, npr } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function getProductsPageData() {
  await assertPermission("products.view");
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

  // Convert Decimal values to numbers for client serialization
  const serializedProducts = products.map((p) => ({
    ...p,
    purchasePrice: Number(p.purchasePrice),
    sellingPrice: Number(p.sellingPrice),
    discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
    variants: p.variants.map((v) => ({
      ...v,
      purchasePrice: Number(v.purchasePrice),
      sellingPrice: Number(v.sellingPrice),
    })),
  }));

  const activeCount = serializedProducts.filter((p) => p.status === "ACTIVE").length;
  const inactiveCount = serializedProducts.filter((p) => p.status === "INACTIVE").length;

  return {
    products: serializedProducts,
    categories,
    brands,
    suppliers,
    stats: {
      total: serializedProducts.length,
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
  const access = await assertPermission("products.add");
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id;
  if (!userId) throw new Error("User ID not found in session. Please log in again.");

  // Verify user exists in database
  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    throw new Error("User account not found in database. Please log out and log back in.");
  }

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

      if (v.quantity > 0 && userId) {
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

  await logAudit({
    actor: access,
    action: "created",
    title: "Created Product",
    module: "Products",
    entityType: "Product",
    entityId: input.sku,
    description: `Created product "${input.name}" (${input.sku}) with ${variants.length} variant${variants.length === 1 ? "" : "s"}, selling price ${npr(input.sellingPrice)}`,
    next: {
      name: input.name,
      sku: input.sku,
      purchasePrice: Number(input.purchasePrice),
      sellingPrice: Number(input.sellingPrice),
      variants: variants.length,
    },
  });

  revalidatePath("/products");
}

export async function updateProduct(
  id: string,
  input: ProductInput & { variants: (VariantInput & { delete?: boolean })[] }
) {
  const access = await assertPermission("products.edit");
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id;
  if (!userId) throw new Error("User ID not found in session. Please log in again.");

  // Verify user exists in database
  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    throw new Error("User account not found in database. Please log out and log back in.");
  }

  const before = await prisma.product.findUnique({
    where: { id },
    select: {
      name: true,
      sku: true,
      status: true,
      categoryId: true,
      brandId: true,
      imageUrl: true,
      purchasePrice: true,
      sellingPrice: true,
      discountPrice: true,
      variants: {
        select: { id: true, sku: true, size: true, color: true, purchasePrice: true, sellingPrice: true, status: true },
      },
    },
  });
  if (before) {
    const num = (v: unknown) => (v == null ? null : Number(v));
    const pricesChanged =
      num(before.purchasePrice) !== num(input.purchasePrice) ||
      num(before.sellingPrice) !== num(input.sellingPrice) ||
      num(before.discountPrice) !== num(input.discountPrice ?? null) ||
      input.variants.some((v) => {
        const old = before.variants.find((b) => b.id === (v as { id?: string }).id);
        return (
          !old ||
          num(old.purchasePrice) !== num((v as { purchasePrice?: unknown }).purchasePrice) ||
          num(old.sellingPrice) !== num((v as { sellingPrice?: unknown }).sellingPrice)
        );
      });
    if (pricesChanged) await assertPermission("products.edit_price");
  }

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

        if (v.quantity > 0 && userId) {
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

  if (before) {
    const num = (v: unknown) => (v == null ? null : Number(v));
    const vLabel = (v: { size?: string | null; color?: string | null; sku?: string | null }) =>
      [v.size, v.color].filter(Boolean).join(" / ") || v.sku || "variant";

    const priceLines: string[] = [];
    const priceBefore: Record<string, unknown> = {};
    const priceAfter: Record<string, unknown> = {};
    const track = (label: string, was: unknown, now: unknown) => {
      if (num(was) !== num(now)) {
        priceLines.push(`${label}: ${npr(num(was) ?? 0)} -> ${npr(num(now) ?? 0)}`);
        priceBefore[label] = num(was);
        priceAfter[label] = num(now);
      }
    };
    track(`${input.name} selling price`, before.sellingPrice, input.sellingPrice);
    track(`${input.name} purchase price`, before.purchasePrice, input.purchasePrice);
    for (const v of input.variants) {
      const old = before.variants.find((b) => b.id === v.id);
      if (!old || v.delete) continue;
      track(`${input.name} (${vLabel(v)}) selling price`, old.sellingPrice, v.sellingPrice);
      track(`${input.name} (${vLabel(v)}) purchase price`, old.purchasePrice, v.purchasePrice);
    }
    if (priceLines.length) {
      await logAudit({
        actor: access,
        action: "price_changed",
        title: "Changed Price",
        module: "Products",
        entityType: "Product",
        entityId: id,
        description: priceLines.join("; "),
        previous: priceBefore,
        next: priceAfter,
      });
    }

    const other: string[] = [];
    if (before.name !== input.name) other.push(`name: ${before.name} -> ${input.name}`);
    if (before.sku !== input.sku) other.push(`SKU: ${before.sku} -> ${input.sku}`);
    if (before.status !== input.status) other.push(`status: ${before.status} -> ${input.status}`);
    if ((before.categoryId ?? "") !== (input.categoryId ?? "")) other.push("category changed");
    if ((before.brandId ?? "") !== (input.brandId ?? "")) other.push("brand changed");
    if ((before.imageUrl ?? "") !== (input.imageUrl ?? "")) other.push("image changed");
    for (const v of input.variants) {
      if (!v.id) other.push(`variant added: ${vLabel(v)}`);
      else if (v.delete) other.push(`variant removed: ${vLabel(before.variants.find((b) => b.id === v.id) ?? v)}`);
      else {
        const old = before.variants.find((b) => b.id === v.id);
        if (old && (old.sku !== v.sku || (old.size ?? "") !== (v.size ?? "") || (old.color ?? "") !== (v.color ?? ""))) {
          other.push(`variant edited: ${vLabel(old)} -> ${vLabel(v)}`);
        }
      }
    }
    if (other.length || !priceLines.length) {
      await logAudit({
        actor: access,
        action: "updated",
        title: "Edited Product",
        module: "Products",
        entityType: "Product",
        entityId: id,
        description: `Edited product "${input.name}"${other.length ? ": " + other.join("; ") : ""}`,
      });
    }
  }

  revalidatePath("/products");
}

export async function toggleProductStatus(id: string) {
  const access = await assertPermission("products.delete");
  const product = await prisma.product.findUnique({
    where: { id },
    select: { status: true, name: true, sku: true },
  });
  if (!product) throw new Error("Product not found");

  const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  await prisma.product.update({
    where: { id },
    data: { status: nextStatus },
  });
  await logAudit({
    actor: access,
    action: nextStatus === "ACTIVE" ? "activated" : "deactivated",
    title: nextStatus === "ACTIVE" ? "Reactivated Product" : "Deactivated Product",
    module: "Products",
    entityType: "Product",
    entityId: id,
    description: `${nextStatus === "ACTIVE" ? "Reactivated" : "Deactivated"} product "${product.name}" (${product.sku})`,
    previous: { status: product.status },
    next: { status: nextStatus },
  });

  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  const access = await assertPermission("products.delete");
  const hasSales = await prisma.saleItem.count({
    where: { productVariant: { productId: id } },
  });
  if (hasSales > 0) {
    throw new Error("Cannot delete a product that has sales history. Deactivate it instead.");
  }

  const gone = await prisma.product.findUnique({ where: { id }, select: { name: true, sku: true } });
  await prisma.product.delete({ where: { id } });
  await logAudit({
    actor: access,
    action: "deleted",
    title: "Deleted Product",
    module: "Products",
    entityType: "Product",
    entityId: id,
    description: `Deleted product "${gone?.name ?? id}" (${gone?.sku ?? "-"})`,
    previous: gone ?? undefined,
  });
  revalidatePath("/products");
}

export async function createCategory(name: string) {
  const access = await assertPermission("products.add", "products.edit");
  const category = await prisma.category.create({ data: { name: name.trim() } });
  await logAudit({ actor: access, action: "created", title: "Created Category", module: "Products", entityType: "Category", entityId: category.id, description: `Created category "${category.name}"` });
  revalidatePath("/products");
  return category;
}

export async function createBrand(name: string) {
  const access = await assertPermission("products.add", "products.edit");
  const brand = await prisma.brand.create({ data: { name: name.trim() } });
  await logAudit({ actor: access, action: "created", title: "Created Brand", module: "Products", entityType: "Brand", entityId: brand.id, description: `Created brand "${brand.name}"` });
  revalidatePath("/products");
  return brand;
}

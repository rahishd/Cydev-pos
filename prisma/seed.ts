import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ownerUserId = (process.env.SEED_OWNER_USER_ID ?? "U001").toUpperCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "changeme123";
  const name = process.env.SEED_OWNER_NAME ?? "Owner";

  const existing = await prisma.user.findUnique({ where: { userId: ownerUserId } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, userId: ownerUserId, passwordHash, role: "OWNER" },
    });
    console.log(`Created Owner account: ${ownerUserId} / ${password}`);
  } else {
    console.log(`Owner account already exists: ${ownerUserId}`);
  }

  // Seed categories if empty
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    const categories = await prisma.category.createMany({
      data: [
        { name: "Shoes" },
        { name: "Bags" },
        { name: "Accessories" },
      ],
    });
    console.log(`Created ${categories.count} categories`);
  }

  // Seed brands if empty
  const brandCount = await prisma.brand.count();
  if (brandCount === 0) {
    const brands = await prisma.brand.createMany({
      data: [
        { name: "Nike" },
        { name: "Adidas" },
        { name: "Wildcraft" },
        { name: "Puma" },
      ],
    });
    console.log(`Created ${brands.count} brands`);
  }

  // Seed products and variants if empty
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();

    const shoesCategory = categories.find((c) => c.name === "Shoes")!;
    const bagsCategory = categories.find((c) => c.name === "Bags")!;

    const nikerBrand = brands.find((b) => b.name === "Nike")!;
    const adidasBrand = brands.find((b) => b.name === "Adidas")!;
    const wildcraftBrand = brands.find((b) => b.name === "Wildcraft")!;

    // Create products with variants
    const product1 = await prisma.product.create({
      data: {
        name: "Nike Air Max",
        sku: "NK-AIR-MAX-001",
        categoryId: shoesCategory.id,
        brandId: nikerBrand.id,
        purchasePrice: "4500",
        sellingPrice: "6500",
        status: "ACTIVE",
        variants: {
          create: [
            {
              sku: "NK-42-BLK",
              size: "42",
              color: "Black",
              quantity: 2,
              minStockLevel: 5,
              purchasePrice: "4500",
              sellingPrice: "6500",
              status: "ACTIVE",
            },
            {
              sku: "NK-43-BLK",
              size: "43",
              color: "Black",
              quantity: 8,
              minStockLevel: 5,
              purchasePrice: "4500",
              sellingPrice: "6500",
              status: "ACTIVE",
            },
            {
              sku: "NK-44-WHT",
              size: "44",
              color: "White",
              quantity: 12,
              minStockLevel: 5,
              purchasePrice: "4500",
              sellingPrice: "6500",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    const product2 = await prisma.product.create({
      data: {
        name: "Adidas Running Shoe",
        sku: "AD-RUN-SHOE-001",
        categoryId: shoesCategory.id,
        brandId: adidasBrand.id,
        purchasePrice: "3800",
        sellingPrice: "5500",
        status: "ACTIVE",
        variants: {
          create: [
            {
              sku: "AD-W41",
              size: "41",
              color: "White",
              quantity: 6,
              minStockLevel: 3,
              purchasePrice: "3800",
              sellingPrice: "5500",
              status: "ACTIVE",
            },
            {
              sku: "AD-B41",
              size: "41",
              color: "Black",
              quantity: 0,
              minStockLevel: 3,
              purchasePrice: "3800",
              sellingPrice: "5500",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    const product3 = await prisma.product.create({
      data: {
        name: "Wildcraft Backpack",
        sku: "WC-BACKPACK-001",
        categoryId: bagsCategory.id,
        brandId: wildcraftBrand.id,
        purchasePrice: "2200",
        sellingPrice: "3500",
        status: "ACTIVE",
        variants: {
          create: [
            {
              sku: "WB-BLK",
              color: "Black",
              quantity: 0,
              minStockLevel: 3,
              purchasePrice: "2200",
              sellingPrice: "3500",
              status: "ACTIVE",
            },
            {
              sku: "WB-RED",
              color: "Red",
              quantity: 4,
              minStockLevel: 3,
              purchasePrice: "2200",
              sellingPrice: "3500",
              status: "ACTIVE",
            },
            {
              sku: "WB-BLUE",
              color: "Blue",
              quantity: 18,
              minStockLevel: 5,
              purchasePrice: "2200",
              sellingPrice: "3500",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    console.log(`Created 3 products with 8 variants`);
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

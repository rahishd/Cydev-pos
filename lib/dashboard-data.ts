import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth, subDays } from "@/lib/date-utils";

export async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const sevenDaysAgo = startOfDay(subDays(now, 6));

  const [
    todaySalesAgg,
    monthlySalesAgg,
    inventoryVariants,
    customerCreditsAgg,
    supplierPayablesAgg,
    lowStockVariants,
    recentSales,
    paymentMethodGroups,
    topSaleItems,
    dailySales,
    customerCreditList,
    supplierPayableList,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.productVariant.findMany({
      select: { quantity: true, purchasePrice: true },
    }),
    prisma.customerCredit.aggregate({
      _sum: { amount: true, amountPaid: true },
    }),
    prisma.purchase.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.productVariant.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        quantity: true,
        minStockLevel: true,
        product: { select: { name: true } },
      },
      orderBy: { quantity: "asc" },
      take: 20,
    }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } },
        staff: { select: { name: true } },
        payments: { select: { method: true }, take: 1 },
      },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.saleItem.groupBy({
      by: ["productVariantId"],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { total: true, createdAt: true },
    }),
    prisma.customerCredit.findMany({
      select: {
        id: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.purchase.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true,
        purchaseNo: true,
        total: true,
        paidAmount: true,
        supplier: { select: { name: true } },
        date: true,
      },
      orderBy: { date: "desc" },
      take: 6,
    }),
  ]);

  // Profit queries
  const todaySaleItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: todayStart } } },
    select: { quantity: true, unitPrice: true, unitCost: true, discount: true },
  });
  const monthlySaleItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: monthStart } } },
    select: { quantity: true, unitPrice: true, unitCost: true, discount: true },
  });

  const calcProfit = (items: typeof todaySaleItems) =>
    items.reduce((sum, i) => {
      const revenue = Number(i.unitPrice) * i.quantity - Number(i.discount);
      const cost = Number(i.unitCost) * i.quantity;
      return sum + (revenue - cost);
    }, 0);

  // Inventory value
  const totalInventoryValue = inventoryVariants.reduce(
    (sum, v) => sum + v.quantity * Number(v.purchasePrice),
    0
  );

  // Receivables & payables
  const totalReceivables =
    Number(customerCreditsAgg._sum.amount ?? 0) -
    Number(customerCreditsAgg._sum.amountPaid ?? 0);

  const totalPayables =
    Number(supplierPayablesAgg._sum.total ?? 0) -
    Number(supplierPayablesAgg._sum.paidAmount ?? 0);

  // Low stock: filter where quantity <= minStockLevel
  const lowStock = lowStockVariants.filter((v) => v.quantity <= v.minStockLevel);

  // Daily chart for last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(subDays(now, 6 - i));
    const nextDay = new Date(day.getTime() + 86400000);
    const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const sales = dailySales
      .filter((s) => s.createdAt >= day && s.createdAt < nextDay)
      .reduce((sum, s) => sum + Number(s.total), 0);
    return { date: label, sales };
  });

  // Enrich top products
  const enrichedTopProducts = await Promise.all(
    topSaleItems.map(async (item) => {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        select: {
          size: true,
          color: true,
          product: { select: { name: true } },
        },
      });
      return {
        id: item.productVariantId,
        name: variant?.product.name ?? "—",
        variant: [variant?.size, variant?.color].filter(Boolean).join(" / ") || "—",
        qtySold: item._sum.quantity ?? 0,
        revenue: Number(item._sum.total ?? 0),
      };
    })
  );

  return {
    kpi: {
      todaySales: Number(todaySalesAgg._sum.total ?? 0),
      todayTransactions: todaySalesAgg._count.id,
      todayProfit: calcProfit(todaySaleItems),
      monthlySales: Number(monthlySalesAgg._sum.total ?? 0),
      monthlyProfit: calcProfit(monthlySaleItems),
      inventoryValue: totalInventoryValue,
      receivables: Math.max(0, totalReceivables),
      payables: Math.max(0, totalPayables),
    },
    chartData,
    salesByPaymentMethod: paymentMethodGroups.map((p) => ({
      method: p.method,
      amount: Number(p._sum.amount ?? 0),
    })),
    topProducts: enrichedTopProducts,
    lowStockItems: lowStock.slice(0, 8),
    recentSales,
    customerCreditList: customerCreditList.filter(
      (c) => Number(c.amount) > Number(c.amountPaid)
    ),
    supplierPayableList: supplierPayableList.filter(
      (p) => Number(p.total) > Number(p.paidAmount)
    ),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

"use server";

import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { startOfDay, startOfMonth, subDays } from "@/lib/date-utils";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardDataByDateRange({
  dateRange,
  customStart,
  customEnd,
}: {
  dateRange: "today" | "yesterday" | "thisWeek" | "custom";
  customStart?: string;
  customEnd?: string;
}) {
  const access = await assertPermission("dashboard.view");
  const canSeeProfit = access.can("reports.gross_profit") || access.can("reports.net_profit");

  const now = new Date();
  let filterStart = startOfDay(now);
  let filterEnd = new Date();

  if (dateRange === "today") {
    filterStart = startOfDay(now);
    filterEnd = new Date();
  } else if (dateRange === "yesterday") {
    const yesterday = subDays(now, 1);
    filterStart = startOfDay(yesterday);
    filterEnd = startOfDay(now);
  } else if (dateRange === "thisWeek") {
    filterStart = startOfWeek(now);
    filterEnd = new Date();
  } else if (dateRange === "custom" && customStart && customEnd) {
    filterStart = new Date(customStart);
    filterEnd = new Date(customEnd);
    filterEnd.setHours(23, 59, 59, 999);
  }

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
      where: { createdAt: { gte: filterStart, lt: filterEnd } },
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
      where: { createdAt: { gte: filterStart, lt: filterEnd } },
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
      where: { sale: { createdAt: { gte: filterStart, lt: filterEnd } } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.saleItem.groupBy({
      by: ["productVariantId"],
      where: { sale: { createdAt: { gte: filterStart, lt: filterEnd } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: {
        createdAt: true,
        total: true,
      },
    }),
    prisma.customerCredit.findMany({
      take: 10,
      select: {
        id: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
        customer: { select: { name: true, phone: true } },
      },
    }),
    prisma.purchase.findMany({
      where: { status: { not: "CANCELLED" } },
      take: 10,
      select: {
        id: true,
        purchaseNo: true,
        total: true,
        paidAmount: true,
        supplier: { select: { name: true } },
      },
    }),
  ]);

  // Group daily sales
  const dailyMap = new Map<string, number>();
  dailySales.forEach((sale) => {
    const dateStr = sale.createdAt.toISOString().split("T")[0];
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + Number(sale.total));
  });

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sales: dailyMap.get(dateStr) || 0,
    };
  });

  // Process payment methods
  const salesByPaymentMethod = paymentMethodGroups.map((group: any) => ({
    method: group.method,
    amount: Number(group._sum.amount || 0),
  }));

  // Process top products - fetch variant details
  const topProductsWithVariants = await Promise.all(
    topSaleItems.map(async (item: any) => {
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
        name: variant?.product.name || "—",
        variant: [variant?.size, variant?.color].filter(Boolean).join(" / ") || "—",
        qtySold: item._sum.quantity || 0,
        revenue: Number(item._sum.total || 0),
      };
    })
  );

  // Low stock items
  const lowStockThreshold = Number((await getSettings()).inventory.lowStockThreshold);
  const lowStockItems = lowStockVariants
    .filter((v: any) => v.quantity <= (v.minStockLevel > 0 ? v.minStockLevel : lowStockThreshold))
    .slice(0, 10);

  // KPI calculations
  const itemSelect = {
    quantity: true,
    unitPrice: true,
    unitCost: true,
    discount: true,
  } as const;
  const [rangeItems, monthItems] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: filterStart, lt: filterEnd } } },
      select: itemSelect,
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: monthStart } } },
      select: itemSelect,
    }),
  ]);
  const calcProfit = (items: typeof rangeItems) =>
    items.reduce(
      (sum, i) =>
        sum +
        (Number(i.unitPrice) * i.quantity - Number(i.discount)) -
        Number(i.unitCost) * i.quantity,
      0
    );
  const todayProfit = calcProfit(rangeItems);

  const kpi = {
    todaySales: Number(todaySalesAgg._sum.total || 0),
    todayTransactions: todaySalesAgg._count.id || 0,
    todayProfit: canSeeProfit ? todayProfit : 0,
    monthlySales: Number(monthlySalesAgg._sum.total || 0),
    monthlyProfit: canSeeProfit ? calcProfit(monthItems) : 0,
    inventoryValue: inventoryVariants.reduce(
      (sum: number, v: any) => sum + v.quantity * Number(v.purchasePrice),
      0
    ),
    receivables:
      Number(customerCreditsAgg._sum.amount || 0) -
      Number(customerCreditsAgg._sum.amountPaid || 0),
    payables:
      Number(supplierPayablesAgg._sum.total || 0) -
      Number(supplierPayablesAgg._sum.paidAmount || 0),
  };

  return {
    kpi,
    chartData,
    salesByPaymentMethod,
    topProducts: topProductsWithVariants,
    lowStockItems,
    recentSales,
    customerCreditList,
    supplierPayableList,
  };
}

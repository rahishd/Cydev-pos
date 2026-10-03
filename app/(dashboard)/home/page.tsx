import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { nepalDayStart } from "@/lib/date-utils";
import { HomeHub } from "@/components/layout/HomeHub";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const access = await requirePermission();

  let summary: { todaySales: number; todayCount: number } | null = null;
  if (access.can("dashboard.view")) {
    const agg = await prisma.sale.aggregate({
      where: { createdAt: { gte: nepalDayStart() }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: { id: true },
    });
    summary = { todaySales: Number(agg._sum.total ?? 0), todayCount: agg._count.id };
  }

  return <HomeHub summary={summary} isOwner={access.isOwner} permissions={access.permissions} />;
}

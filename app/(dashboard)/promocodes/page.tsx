import { requirePermission } from "@/lib/access";
import { PromoCodesClient } from "@/components/promos/PromoCodesClient";
import { getPromoPageData } from "@/app/(dashboard)/promocodes/actions";
import { nepalToday } from "@/lib/reports/range";

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  await requirePermission("promos.view");
  const data = await getPromoPageData();
  return <PromoCodesClient data={data} today={nepalToday()} />;
}

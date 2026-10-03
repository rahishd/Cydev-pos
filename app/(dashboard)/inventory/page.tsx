import { requirePermission } from "@/lib/access";
import { getInventoryPageData } from "./actions";
import { InventoryClient } from "@/components/inventory/InventoryClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  category?: string;
  brand?: string;
  stock?: string;
}>;

export default async function InventoryPage(props: {
  searchParams: SearchParams;
}) {
  await requirePermission("inventory.view");
  const searchParams = await props.searchParams;
  const data = await getInventoryPageData(
    searchParams.search,
    searchParams.category,
    searchParams.brand,
    (searchParams.stock as any) || "all"
  );

  return <InventoryClient data={data} />;
}

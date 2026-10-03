import { requirePermission } from "@/lib/access";
import { getPurchasesPageData } from "./actions";
import { PurchasesClient } from "@/components/purchases/PurchasesClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  supplier?: string;
  status?: string;
  paymentStatus?: string;
}>;

export default async function PurchasesPage(props: {
  searchParams: SearchParams;
}) {
  await requirePermission("purchases.view");
  const searchParams = await props.searchParams;
  const data = await getPurchasesPageData(
    searchParams.search,
    searchParams.supplier,
    searchParams.status,
    searchParams.paymentStatus
  );

  return <PurchasesClient data={data} />;
}

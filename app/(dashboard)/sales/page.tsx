import { requirePermission } from "@/lib/access";
import { getSalesHistory } from "./actions";
import { SalesClient } from "@/components/sales/SalesClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  tab?: string;
  search?: string;
  customer?: string;
  method?: string;
}>;

export default async function SalesPage(props: {
  searchParams: SearchParams;
}) {
  const access = await requirePermission("sales.create", "sales.history", "sales.return", "sales.exchange");
  const allowedTabs = [
    access.can("sales.create") && "pos",
    access.can("sales.history") && "history",
    (access.can("sales.return") || access.can("sales.exchange")) && "returns",
  ].filter(Boolean) as string[];
  const searchParams = await props.searchParams;

  const requestedTab = searchParams.tab || "pos";
  const tab = allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0];
  const search = searchParams.search || "";
  const customerId = searchParams.customer || "";
  const paymentMethod = searchParams.method || "";

  let salesHistory: any[] = [];
  if (tab === "history") {
    salesHistory = await getSalesHistory(search, customerId, paymentMethod);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Sales / POS</h1>
        <p className="text-sm text-text-muted">Manage point of sale, invoicing, and returns</p>
      </div>

      <SalesClient
        allowedTabs={allowedTabs}
        initialTab={tab}
        initialSearch={search}
        initialCustomerId={customerId}
        initialPaymentMethod={paymentMethod}
        initialSalesHistory={salesHistory}
      />
    </div>
  );
}

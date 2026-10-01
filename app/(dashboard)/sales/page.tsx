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
  const searchParams = await props.searchParams;

  const tab = searchParams.tab || "pos";
  const search = searchParams.search || "";
  const customerId = searchParams.customer || "";
  const paymentMethod = searchParams.method || "";

  let salesHistory = [];
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
        initialTab={tab}
        initialSearch={search}
        initialCustomerId={customerId}
        initialPaymentMethod={paymentMethod}
        initialSalesHistory={salesHistory}
      />
    </div>
  );
}

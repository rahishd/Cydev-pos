import { getCustomersPageData } from "./actions";
import { CustomersClient } from "@/components/customers/CustomersClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  status?: string;
  outstanding?: string;
}>;

export default async function CustomersPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;

  const data = await getCustomersPageData(
    searchParams.search,
    searchParams.status,
    searchParams.outstanding === "true"
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Customers</h1>
        <p className="text-sm text-text-muted">Manage customer profiles, purchase history, and receivables</p>
      </div>

      <CustomersClient data={data} />
    </div>
  );
}

import { requirePermission } from "@/lib/access";
import { getCustomerDetails } from "../actions";
import { CustomerDetailClient } from "@/components/customers/CustomerDetailClient";

export const dynamic = "force-dynamic";

type Params = Promise<{
  id: string;
}>;

export default async function CustomerDetailPage(props: {
  params: Params;
}) {
  await requirePermission("customers.history", "customers.view");
  const params = await props.params;
  const data = await getCustomerDetails(params.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{data.customer.name}</h1>
          <p className="text-sm text-text-muted">{data.customer.phone}</p>
        </div>
      </div>

      <CustomerDetailClient data={data} customerId={params.id} />
    </div>
  );
}

import { requirePermission } from "@/lib/access";
import { getProductsPageData } from "./actions";
import { ProductsClient } from "@/components/products/ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requirePermission("products.view");
  const data = await getProductsPageData();
  return <ProductsClient data={data} />;
}

import { requirePermission } from "@/lib/access";
import { getExpensesPageData } from "./actions";
import ExpensesClient from "@/components/expenses/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requirePermission("expenses.view");
  const data = await getExpensesPageData();

  return <ExpensesClient initialData={data} />;
}

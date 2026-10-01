import { getExpensesPageData } from "./actions";
import ExpensesClient from "@/components/expenses/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const data = await getExpensesPageData();

  return <ExpensesClient initialData={data} />;
}

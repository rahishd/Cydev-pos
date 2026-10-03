import { requireOwner } from "@/lib/access";
import { getUsersPageData } from "./actions";
import { UsersClient } from "@/components/users/UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireOwner();
  const data = await getUsersPageData();
  return <UsersClient data={data} />;
}

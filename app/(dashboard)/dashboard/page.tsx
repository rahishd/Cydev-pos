import { redirect } from "next/navigation";
import { getAccess, homePath } from "@/lib/access";
import DashboardClient from "./DashboardClient";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const access = await getAccess();
  if (!access) redirect("/api/logout");
  if (!access.can("dashboard.view")) redirect(homePath(access));

  return (
    <DashboardClient
      defaultRange={String((await getSettings()).system.defaultDashboardPeriod) as "today" | "yesterday" | "thisWeek"}
      canSeeProfit={access.can("reports.gross_profit") || access.can("reports.net_profit")}
    />
  );
}

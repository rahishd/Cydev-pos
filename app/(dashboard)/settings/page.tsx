import { requirePermission } from "@/lib/access";
import { getSettingsPageData } from "./actions";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission(
    "settings.shop",
    "settings.payment",
    "settings.invoice",
    "settings.inventory",
    "settings.system",
    "data.export"
  );
  const data = await getSettingsPageData();
  return <SettingsClient data={data} />;
}

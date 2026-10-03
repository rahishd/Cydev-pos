import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { getSettings } from "@/lib/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  if (!access) redirect("/api/logout");
  const settings = await getSettings();

  return (
    <SettingsProvider settings={settings}>
    <div className="flex min-h-screen">
      <Sidebar
        isOwner={access.isOwner}
        permissions={access.permissions}
        shopName={String(settings.business.shopName)}
        logo={settings.business.logo ?? "/logo.png"}
      />
      <div className="flex flex-1 flex-col">
        <Topbar userName={access.name} userRole={access.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
    </SettingsProvider>
  );
}

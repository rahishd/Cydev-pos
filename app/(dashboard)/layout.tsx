import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav, MobileHeader } from "@/components/layout/MobileShell";
import { PaymentNotifier } from "@/components/layout/PaymentNotifier";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { getSettings } from "@/lib/settings";

export const maxDuration = 60;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  if (!access) redirect("/api/logout");
  const settings = await getSettings();

  return (
    <SettingsProvider settings={settings} access={{ isOwner: access.isOwner, permissions: access.permissions }}>
    <div className="flex min-h-screen">
      <PaymentNotifier />
      <Sidebar
        isOwner={access.isOwner}
        permissions={access.permissions}
        shopName={String(settings.business.shopName)}
        logo={settings.business.logo ?? "/logo.png"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={access.name} userRole={access.role} />
        <MobileHeader userName={access.name} userRole={access.role} />
        <main className="flex-1 p-3 pb-28 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <MobileBottomNav
        isOwner={access.isOwner}
        permissions={access.permissions}
        userName={access.name}
        userRole={access.role}
      />
    </div>
    </SettingsProvider>
  );
}

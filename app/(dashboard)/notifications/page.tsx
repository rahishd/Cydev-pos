import { requirePermission } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { wantsCategory } from "@/lib/push";
import { Card } from "@/components/ui/Card";
import { PushPanel } from "@/components/settings/PushPanel";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "pushSales", label: "Every new sale" },
  { key: "pushPayments", label: "Payments received (including customer QR payments)" },
  { key: "pushReturns", label: "Returns and exchanges" },
  { key: "pushStock", label: "Stock and product changes" },
  { key: "pushSecurity", label: "Failed sign-ins and locked accounts" },
] as const;

export default async function NotificationsPage() {
  const access = await requirePermission("notifications.push");
  const settings = await getSettings();
  const user = { role: access.role, permissions: access.permissions };
  const mine = CATEGORIES.filter((c) => settings.notifications[c.key] && wantsCategory(user, c.key));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Phone Notifications</h1>
        <p className="text-sm text-text-muted">Turn on alerts for this phone. They arrive even when the screen is locked.</p>
      </div>

      <Card className="p-5">
        <PushPanel />
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-text">You will be told about</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing right now. The Owner controls which alerts are on, and you only receive alerts for areas you have access to.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-text">
            {mine.map((c) => (
              <li key={c.key}>{c.label}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

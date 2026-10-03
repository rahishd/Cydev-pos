import { requirePermission } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { canOpenReport, REPORTS } from "@/lib/reports/catalog";
import { nepalToday } from "@/lib/reports/range";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { getReportFilterOptions } from "@/app/(dashboard)/reports/actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const access = await requirePermission();
  const allowed = REPORTS.filter((r) => canOpenReport(r, access.can)).map((r) => r.key);
  const [options, settings] = await Promise.all([
    allowed.length ? getReportFilterOptions() : Promise.resolve({ categories: [], brands: [], staff: [], customers: [], suppliers: [] }),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-semibold text-text">Reports</h1>
        <p className="text-sm text-text-muted">How the business performed over a period. For live figures use the Dashboard; for who did what, the Audit Log.</p>
      </div>
      <ReportsClient
        allowed={allowed}
        options={options}
        today={nepalToday()}
        canExport={access.can("reports.export")}
        canPrint={access.can("reports.print")}
        userName={access.name}
        shopName={String(settings.business.shopName)}
      />
    </div>
  );
}

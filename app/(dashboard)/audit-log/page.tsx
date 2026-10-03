import { requirePermission } from "@/lib/access";
import { AuditLogClient } from "@/components/audit/AuditLogClient";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  await requirePermission("audit.view");
  return <AuditLogClient />;
}

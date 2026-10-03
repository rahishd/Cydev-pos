// One-off: fills the newer audit columns on entries written before they existed.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { actionLabel, moduleFromType } from "../lib/audit-meta";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.auditLog.findMany({
    where: { module: "" },
    include: { user: { select: { userId: true, name: true, role: true } } },
  });
  for (const r of rows) {
    const title = actionLabel(r.action, null, r.affectedType);
    const next = (r.newValue ?? {}) as Record<string, unknown>;
    let description = title;
    if (r.affectedType === "Expense" && typeof next.amount !== "undefined") {
      description = `${title}: NPR ${Number(next.amount).toLocaleString("en-US")}`;
    } else if (r.affectedType === "Settings") {
      description = `${r.reason ?? "Settings"} changed`;
    } else if (r.affectedType === "User" && typeof next.name === "string") {
      description = `${title}: ${next.userId ?? ""} (${next.name})`;
    }
    await prisma.$executeRaw`
      UPDATE "AuditLog" SET
        "module" = ${moduleFromType(r.affectedType)},
        "title" = ${title},
        "description" = ${description},
        "userCode" = ${r.user?.userId ?? null},
        "userName" = ${r.user?.name ?? null},
        "userRole" = ${r.user?.role ?? null},
        "status" = ${r.action === "login_failed" ? "FAILED" : "SUCCESS"}
      WHERE "id" = ${r.id}`;
  }
  console.log(`Backfilled ${rows.length} audit entries`);
}

main().finally(() => prisma.$disconnect());

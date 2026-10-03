// Makes the AuditLog table append-only at the database level: rows can be added but never
// changed, deleted or truncated, even by someone with direct database access through the app.
// Run once (safe to re-run):  npm run db:audit-lock
// To lift it for a deliberate clean-up:  DROP TRIGGER audit_log_no_change ON "AuditLog";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'The audit log is append-only: % is not allowed', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_log_no_change ON "AuditLog";`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER audit_log_no_change
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_log_no_truncate ON "AuditLog";`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON "AuditLog"
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();
  `);
  console.log("AuditLog is now append-only.");
}

main().finally(() => prisma.$disconnect());

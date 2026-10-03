"use server";

import { signOut } from "@/lib/auth";
import { getAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export async function logoutAction() {
  const access = await getAccess();
  if (access) {
    await logAudit({
      actor: access,
      action: "logout",
      module: "Authentication",
      entityType: "Session",
      entityId: access.id,
      description: "Signed out",
    });
  }
  await signOut({ redirectTo: "/login" });
}

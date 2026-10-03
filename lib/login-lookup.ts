import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

/**
 * Finds who is signing in. People sign in with their contact number; the User ID still works as a
 * fallback (accounts without a saved number, like an Owner who hasn't added one yet, rely on it).
 */
export async function findLoginUser(identifier: string) {
  const raw = identifier.trim();
  const looksLikePhone = /^[+\d\s()-]+$/.test(raw);
  const phone = looksLikePhone ? normalizePhone(raw) : "";

  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { loginPhone: phone } });
    if (byPhone) return byPhone;
  }
  return prisma.user.findUnique({ where: { userId: raw.toUpperCase() } });
}

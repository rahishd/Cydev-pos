"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { describeOffer, normalizeCode, promoState, type PromoState } from "@/lib/promo";
import { isValidDay, nepalDay, toInstants } from "@/lib/reports/range";

export type PromoRow = {
  id: string;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  startDay: string;
  endDay: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  state: PromoState;
  offer: string;
  discountGiven: number;
};

export type PromoInput = {
  id?: string;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  startDay: string;
  endDay: string;
  usageLimit: number | null;
  isActive: boolean;
};

const num = (d: unknown) => Number(d ?? 0);

export async function getPromoPageData() {
  const access = await assertPermission("promos.view");
  const [promos, given] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.sale.groupBy({
      by: ["promoCode"],
      where: { promoCode: { not: null }, status: { not: "CANCELLED" } },
      _sum: { promoDiscount: true },
    }),
  ]);
  const byCode = new Map(given.map((g) => [g.promoCode as string, num(g._sum.promoDiscount)]));

  const rows: PromoRow[] = promos.map((p) => {
    const like = {
      code: p.code,
      type: p.type,
      value: num(p.value),
      minPurchase: num(p.minPurchase),
      maxDiscount: p.maxDiscount === null ? null : num(p.maxDiscount),
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      usageLimit: p.usageLimit,
      usedCount: p.usedCount,
      isActive: p.isActive,
    };
    return {
      id: p.id,
      code: p.code,
      description: p.description ?? "",
      type: p.type,
      value: like.value,
      minPurchase: like.minPurchase,
      maxDiscount: like.maxDiscount,
      startDay: p.startsAt ? nepalDay(p.startsAt) : "",
      endDay: p.endsAt ? nepalDay(p.endsAt) : "",
      usageLimit: p.usageLimit,
      usedCount: p.usedCount,
      isActive: p.isActive,
      state: promoState(like),
      offer: describeOffer(like),
      discountGiven: byCode.get(p.code) ?? 0,
    };
  });

  return {
    rows,
    canManage: access.can("promos.manage"),
    stats: {
      total: rows.length,
      active: rows.filter((r) => r.state === "active").length,
      redemptions: rows.reduce((a, r) => a + r.usedCount, 0),
      discountGiven: rows.reduce((a, r) => a + r.discountGiven, 0),
    },
  };
}

function clean(input: PromoInput) {
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("The code must be 3 to 20 letters, numbers, - or _ (no spaces).");
  if (input.type !== "PERCENT" && input.type !== "FIXED") throw new Error("Choose percentage or fixed amount.");
  const value = Number(input.value);
  if (!(value > 0)) throw new Error("Enter a discount greater than zero.");
  if (input.type === "PERCENT" && value > 100) throw new Error("A percentage can't be more than 100.");
  const minPurchase = Math.max(0, Number(input.minPurchase) || 0);
  const maxDiscount = input.type === "PERCENT" && input.maxDiscount && Number(input.maxDiscount) > 0 ? Number(input.maxDiscount) : null;
  if (input.startDay && !isValidDay(input.startDay)) throw new Error("The start date isn't valid.");
  if (input.endDay && !isValidDay(input.endDay)) throw new Error("The end date isn't valid.");
  if (input.startDay && input.endDay && input.endDay < input.startDay) throw new Error("The end date can't be before the start date.");
  const usageLimit = input.usageLimit && Number(input.usageLimit) > 0 ? Math.floor(Number(input.usageLimit)) : null;
  // Dates are Nepal days: it starts at the start of its first day and stays valid through the end of its last day.
  const startsAt = input.startDay ? toInstants(input.startDay, input.startDay).start : null;
  const endsAt = input.endDay ? new Date(toInstants(input.endDay, input.endDay).end.getTime() - 1) : null;
  return {
    code,
    description: input.description.trim().slice(0, 200) || null,
    type: input.type,
    value: new Decimal(value),
    minPurchase: new Decimal(minPurchase),
    maxDiscount: maxDiscount === null ? null : new Decimal(maxDiscount),
    startsAt,
    endsAt,
    usageLimit,
    isActive: Boolean(input.isActive),
  };
}

export async function savePromo(input: PromoInput) {
  const access = await assertPermission("promos.manage");
  const data = clean(input);

  const clash = await prisma.promoCode.findUnique({ where: { code: data.code }, select: { id: true } });
  if (clash && clash.id !== input.id) throw new Error(`The code ${data.code} already exists.`);

  if (input.id) {
    const before = await prisma.promoCode.findUnique({ where: { id: input.id } });
    if (!before) throw new Error("That promo code no longer exists.");
    if (data.usageLimit !== null && data.usageLimit < before.usedCount) {
      throw new Error(`It has already been used ${before.usedCount} times, so the limit can't be lower than that.`);
    }
    await prisma.promoCode.update({ where: { id: input.id }, data });
    await logAudit({
      actor: access,
      action: "updated",
      title: "Promo Code Edited",
      module: "Promo Codes",
      entityType: "PromoCode",
      entityId: input.id,
      description: `Edited promo code ${data.code}: ${describeOffer({ type: data.type, value: Number(data.value), maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null })}`,
    });
  } else {
    const made = await prisma.promoCode.create({ data: { ...data, createdById: access.id }, select: { id: true } });
    await logAudit({
      actor: access,
      action: "created",
      title: "Promo Code Created",
      module: "Promo Codes",
      entityType: "PromoCode",
      entityId: made.id,
      description: `Created promo code ${data.code}: ${describeOffer({ type: data.type, value: Number(data.value), maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null })}`,
    });
  }
  revalidatePath("/promocodes");
}

export async function setPromoActive(id: string, active: boolean) {
  const access = await assertPermission("promos.manage");
  const p = await prisma.promoCode.update({ where: { id }, data: { isActive: active }, select: { code: true } });
  await logAudit({
    actor: access,
    action: active ? "activated" : "deactivated",
    title: active ? "Promo Code Switched On" : "Promo Code Switched Off",
    module: "Promo Codes",
    entityType: "PromoCode",
    entityId: id,
    description: `${active ? "Switched on" : "Switched off"} promo code ${p.code}`,
  });
  revalidatePath("/promocodes");
}

/** Only codes that were never used can be deleted; used ones are switched off instead so past sales still make sense. */
export async function deletePromo(id: string) {
  const access = await assertPermission("promos.manage");
  const p = await prisma.promoCode.findUnique({ where: { id }, select: { code: true, usedCount: true } });
  if (!p) return;
  const sold = await prisma.sale.count({ where: { promoCode: p.code } });
  if (p.usedCount > 0 || sold > 0) throw new Error("This code has been used on sales, so it can't be deleted. Switch it off instead.");
  await prisma.promoCode.delete({ where: { id } });
  await logAudit({
    actor: access,
    action: "deleted",
    title: "Promo Code Deleted",
    module: "Promo Codes",
    entityType: "PromoCode",
    entityId: id,
    description: `Deleted promo code ${p.code}`,
  });
  revalidatePath("/promocodes");
}

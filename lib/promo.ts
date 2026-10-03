/** Promo code rules, shared by the Promo Codes page and the checkout so both always agree. */

export type PromoLike = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export type PromoState = "active" | "inactive" | "scheduled" | "expired" | "used_up";

export const normalizeCode = (input: string) => input.trim().toUpperCase().replace(/\s+/g, "");

export function promoState(p: PromoLike, now: Date = new Date()): PromoState {
  if (!p.isActive) return "inactive";
  if (p.startsAt && now < p.startsAt) return "scheduled";
  if (p.endsAt && now > p.endsAt) return "expired";
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return "used_up";
  return "active";
}

const npr = (n: number) => `NPR ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function describeOffer(p: Pick<PromoLike, "type" | "value" | "maxDiscount">): string {
  if (p.type === "FIXED") return `${npr(p.value)} off`;
  return `${p.value}% off${p.maxDiscount ? `, up to ${npr(p.maxDiscount)}` : ""}`;
}

export type PromoCheck = { ok: true; discount: number; label: string } | { ok: false; message: string };

/** Whether the code can be used on a bill of this size right now, and the discount it gives. `subtotal` is after any item discounts. */
export function evaluatePromo(p: PromoLike | null, subtotal: number, now: Date = new Date()): PromoCheck {
  if (!p) return { ok: false, message: "That promo code isn't valid." };
  const state = promoState(p, now);
  if (state === "inactive") return { ok: false, message: "That promo code is switched off." };
  if (state === "scheduled") return { ok: false, message: "That promo code hasn't started yet." };
  if (state === "expired") return { ok: false, message: "That promo code has expired." };
  if (state === "used_up") return { ok: false, message: "That promo code has been used the maximum number of times." };
  if (subtotal <= 0) return { ok: false, message: "Add items to the order first." };
  if (subtotal + 0.001 < p.minPurchase) {
    return { ok: false, message: `This code needs a purchase of at least ${npr(p.minPurchase)}.` };
  }

  let discount = p.type === "PERCENT" ? (subtotal * p.value) / 100 : p.value;
  if (p.type === "PERCENT" && p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
  discount = Math.min(discount, subtotal);
  discount = Math.round(discount * 100) / 100;
  return { ok: true, discount, label: `${p.code}: ${describeOffer(p)}` };
}

/** Turns a database row (with Decimal fields) into the plain numbers the rules work with. */
export function toPromoLike(p: {
  code: string;
  type: "PERCENT" | "FIXED";
  value: unknown;
  minPurchase: unknown;
  maxDiscount: unknown;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}): PromoLike {
  return {
    code: p.code,
    type: p.type,
    value: Number(p.value),
    minPurchase: Number(p.minPurchase),
    maxDiscount: p.maxDiscount === null ? null : Number(p.maxDiscount),
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    usageLimit: p.usageLimit,
    usedCount: p.usedCount,
    isActive: p.isActive,
  };
}

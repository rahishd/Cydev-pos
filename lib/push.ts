import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushResult = { sent: number; failed: number; removed: number };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://example.com", publicKey, privateKey);
  configured = true;
  return true;
}

export const pushConfigured = () => configure();

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(subs: Sub[], payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: 0 };
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" }
        );
        result.sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 mean the phone removed the subscription: forget it so we stop trying.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          result.removed++;
        } else {
          result.failed++;
          console.error("Push failed:", status, (e as { body?: string }).body?.slice(0, 120));
        }
      }
    })
  );
  return result;
}

export async function pushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  if (!configure()) return { sent: 0, failed: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  return deliver(subs, payload);
}

type Category = "pushSales" | "pushPayments" | "pushReturns" | "pushStock" | "pushSecurity";

/** Staff only hear about areas they can already see; security alerts are Owner-only. */
export const CATEGORY_NEEDS: Record<Category, string[]> = {
  pushSales: ["sales.history"],
  pushPayments: ["sales.history", "sales.online_payment"],
  pushReturns: ["sales.return", "sales.exchange"],
  pushStock: ["inventory.history", "inventory.view"],
  pushSecurity: [],
};

export function wantsCategory(
  user: { role: string; permissions: string[] },
  category: Category
): boolean {
  if (user.role === "OWNER") return true;
  if (!user.permissions.includes("notifications.push")) return false;
  return CATEGORY_NEEDS[category].some((p) => user.permissions.includes(p));
}

/** Owners, plus staff holding the notifications permission and access to that area. Never the person who acted. */
export async function pushToRecipients(
  category: Category,
  payload: PushPayload,
  exceptUserId?: string | null
): Promise<PushResult> {
  if (!configure()) return { sent: 0, failed: 0, removed: 0 };
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: "OWNER" }, { permissions: { has: "notifications.push" } }],
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true, role: true, permissions: true },
  });
  const ids = users.filter((u) => wantsCategory(u, category)).map((u) => u.id);
  if (ids.length === 0) return { sent: 0, failed: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
  return deliver(subs, payload);
}

/** Decides whether an audit event deserves a phone notification, and which Settings switch controls it. */
export function classify(e: {
  action: string;
  module: string;
  title?: string;
}): { category: Category; url: string } | null {
  if (e.module === "Sales" && e.action === "created") return { category: "pushSales", url: "/sales?tab=history" };
  if (e.action === "payment") return { category: "pushPayments", url: "/sales?tab=history" };
  if (e.action === "return" || e.action === "exchange") return { category: "pushReturns", url: "/sales?tab=history" };
  if (e.module === "Inventory" || e.action === "price_changed") return { category: "pushStock", url: "/inventory" };
  if (e.module === "Products" && ["created", "updated", "deleted", "deactivated", "activated"].includes(e.action)) {
    return { category: "pushStock", url: "/products" };
  }
  if (e.action === "account_locked" || e.action === "login_failed") return { category: "pushSecurity", url: "/audit-log" };
  return null;
}

export async function notifyOwnersOfEvent(e: {
  action: string;
  module: string;
  title?: string;
  description: string;
  actor?: { id?: string | null; name?: string | null; userId?: string | null } | null;
  status?: string;
}): Promise<void> {
  if (!configure()) return;
  if (e.status === "FAILED" && e.action !== "login_failed") return;
  const hit = classify(e);
  if (!hit) return;
  const settings = await getSettings();
  if (!settings.notifications[hit.category]) return;

  const who = e.actor?.name ? `${e.actor.name}${e.actor.userId ? ` (${e.actor.userId})` : ""}` : "Customer";
  await pushToRecipients(
    hit.category,
    {
      title: e.title || String(settings.business.shopName),
      body: `${who}: ${e.description}`.slice(0, 180),
      url: hit.url,
      tag: hit.category,
    },
    e.actor?.id ?? null
  );
}

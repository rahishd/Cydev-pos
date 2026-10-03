"use server";

import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { pushConfigured, pushToUser } from "@/lib/push";
import { getSettings } from "@/lib/settings";

export async function getPushStatus() {
  const access = await assertPermission("notifications.push");
  const devices = await prisma.pushSubscription.count({ where: { userId: access.id } });
  return { configured: pushConfigured(), devices };
}

export async function savePushSubscription(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  device: string
) {
  const access = await assertPermission("notifications.push");
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("That phone sent an invalid notification subscription.");
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: access.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device: device.slice(0, 160) },
    create: {
      userId: access.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      device: device.slice(0, 160),
    },
  });
  await logAudit({
    actor: access,
    action: "created",
    title: "Phone Notifications Enabled",
    module: "Settings",
    entityType: "Settings",
    entityId: "notifications",
    description: "Turned on phone notifications for a device",
  });
}

export async function removePushSubscription(endpoint: string) {
  const access = await assertPermission("notifications.push");
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: access.id } });
  await logAudit({
    actor: access,
    action: "deleted",
    title: "Phone Notifications Disabled",
    module: "Settings",
    entityType: "Settings",
    entityId: "notifications",
    description: "Turned off phone notifications for a device",
  });
}

export async function sendTestPush() {
  const access = await assertPermission("notifications.push");
  if (!pushConfigured()) throw new Error("Push notifications aren't set up on the server yet.");
  const shop = String((await getSettings()).business.shopName);
  const result = await pushToUser(access.id, {
    title: `${shop}: test notification`,
    body: "Phone notifications are working. You'll get alerts for sales, payments, returns and stock changes.",
    url: "/home",
    tag: "test",
  });
  return result;
}

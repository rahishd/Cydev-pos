"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { GATEWAYS, PAYMENT_WINDOW_MS, isGateway } from "@/lib/online-pay";
import { lanAddress } from "@/lib/lan";
import { logAudit, npr } from "@/lib/audit";

export type OnlineGateway = { id: string; label: string };

/** Khalti, eSewa and Fonepay when QR payments are on; nothing when they are off. */
export async function getOnlineGateways(): Promise<OnlineGateway[]> {
  await assertPermission("sales.create");
  if (!(await getSettings()).payments.demoQr) return [];
  return Object.entries(GATEWAYS).map(([id, g]) => ({ id, label: g.label }));
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return { origin: configured, local: false };

  // "localhost" is the phone itself when scanned, so swap in this computer's Wi-Fi address.
  const [hostname, port] = (host ?? "").split(":");
  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)) {
    const ip = lanAddress();
    if (ip) return { origin: `${proto}://${ip}${port ? ":" + port : ""}`, local: true };
  }
  return { origin: `${proto}://${host}`, local: /^(10\.|192\.168\.|172\.)/.test(hostname) };
}

export async function createPaymentRequest(gateway: string, amount: number, saleId?: string) {
  const access = await assertPermission("sales.create");
  const settings = await getSettings();

  if (!settings.payments.demoQr) throw new Error("QR payments are turned off in Settings.");
  if (!isGateway(gateway)) throw new Error("Unknown payment gateway.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount to collect online.");
  if (saleId) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { total: true, amountPaid: true } });
    if (!sale) throw new Error("Sale not found.");
    const due = Number(sale.total) - Number(sale.amountPaid);
    if (due <= 0.001) throw new Error("This invoice is already fully paid.");
    if (amount > due + 0.001) throw new Error("The amount is more than what is due on this invoice.");
  }

  const token = randomBytes(16).toString("hex");
  const created = await prisma.paymentRequest.create({
    data: {
      token,
      gateway,
      amount,
      createdById: access.id,
      expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS),
    },
    select: { id: true, expiresAt: true },
  });

  const where = await origin();
  return {
    id: created.id,
    token,
    url: `${where.origin}/pay/${token}`,
    local: where.local,
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function cancelPaymentRequest(id: string) {
  const access = await assertPermission("sales.create");
  await prisma.paymentRequest.updateMany({
    where: { id, status: "PENDING", createdById: access.id },
    data: { status: "CANCELLED" },
  });
}

/** Records a customer-confirmed QR payment against the invoice it was collected for. */
export async function applyOnlinePayment(saleId: string, paymentRequestId: string) {
  const access = await assertPermission("sales.create");

  const [sale, pr] = await Promise.all([
    prisma.sale.findUnique({ where: { id: saleId }, select: { invoiceNo: true, total: true, amountPaid: true } }),
    prisma.paymentRequest.findUnique({ where: { id: paymentRequestId } }),
  ]);
  if (!sale) throw new Error("Sale not found.");
  if (!pr || pr.status !== "PAID" || pr.saleId || pr.createdById !== access.id) {
    throw new Error("The online payment could not be verified.");
  }

  const due = Number(sale.total) - Number(sale.amountPaid);
  if (due <= 0.001) throw new Error("This invoice is already fully paid.");
  const applied = Math.min(Number(pr.amount), due);

  // Claim the request first so the same confirmation can never be applied twice.
  const claimed = await prisma.paymentRequest.updateMany({
    where: { id: pr.id, saleId: null },
    data: { saleId },
  });
  if (claimed.count !== 1) throw new Error("This online payment was already used.");

  await prisma.payment.create({ data: { saleId, method: pr.gateway as never, amount: applied } });
  const paid = Number(sale.amountPaid) + applied;
  await prisma.sale.update({ where: { id: saleId }, data: { amountPaid: paid } });

  await logAudit({
    actor: access,
    action: "payment",
    title: "Online Payment Received",
    module: "Sales",
    entityType: "Sale",
    entityId: saleId,
    description: `${sale.invoiceNo}: received ${npr(applied)} via ${GATEWAYS[pr.gateway as keyof typeof GATEWAYS]?.label ?? pr.gateway} QR (demo). Paid ${npr(paid)} of ${npr(Number(sale.total))}`,
    previous: { paid: Number(sale.amountPaid) },
    next: { paid, gateway: pr.gateway, demo: true },
  });

  return { applied, amountPaid: paid, outstanding: Math.max(0, Number(sale.total) - paid), gateway: pr.gateway };
}

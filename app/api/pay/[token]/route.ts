import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logAudit, npr } from "@/lib/audit";
import { GATEWAYS, isGateway, type PayStatus } from "@/lib/online-pay";

export const dynamic = "force-dynamic";

// Public on purpose: the customer's phone has no login. The long random token is the only key.
// This is a DEMONSTRATION gateway: confirming here moves no real money.

function effectiveStatus(r: { status: string; expiresAt: Date }): PayStatus {
  if (r.status === "PENDING" && r.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return r.status as PayStatus;
}

async function load(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return prisma.paymentRequest.findUnique({ where: { token } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await load(token);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await getSettings();
  return NextResponse.json({
    status: effectiveStatus(r),
    gateway: r.gateway,
    amount: Number(r.amount),
    shopName: String(settings.business.shopName),
    reference: r.id.slice(-6).toUpperCase(),
    expiresAt: r.expiresAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await load(token);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Atomic: only a still-pending, unexpired request can become PAID, and only once.
  const claimed = await prisma.paymentRequest.updateMany({
    where: { id: r.id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "PAID", paidAt: new Date() },
  });

  if (claimed.count === 1) {
    const label = isGateway(r.gateway) ? GATEWAYS[r.gateway].label : r.gateway;
    await logAudit({
      actor: null,
      action: "payment",
      title: "Online Payment Confirmed (Demo)",
      module: "Sales",
      entityType: "PaymentRequest",
      entityId: r.id,
      description: `Customer confirmed ${npr(Number(r.amount))} via ${label} QR (demo gateway, no real money moved)`,
      next: { gateway: r.gateway, amount: Number(r.amount), demo: true },
    });
  }

  const fresh = await prisma.paymentRequest.findUnique({ where: { id: r.id } });
  return NextResponse.json({
    status: fresh ? effectiveStatus(fresh) : "EXPIRED",
    amount: Number(r.amount),
  });
}

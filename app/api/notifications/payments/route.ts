import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// Powers the "payment received" pop-up: staff who handle sales (and the Owner) see every online
// payment confirmed since the moment their screen last checked.
export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (!access || !(access.isOwner || access.can("sales.create") || access.can("sales.history"))) {
    return NextResponse.json({ payments: [] }, { status: 200 });
  }

  const since = Number(req.nextUrl.searchParams.get("since"));
  const from = new Date(Number.isFinite(since) && since > 0 ? since : Date.now() - 60_000);

  const rows = await prisma.paymentRequest.findMany({
    where: { status: "PAID", paidAt: { gt: from } },
    orderBy: { paidAt: "asc" },
    take: 10,
    select: { id: true, gateway: true, amount: true, paidAt: true, createdById: true },
  });

  return NextResponse.json({
    payments: rows.map((r) => ({
      id: r.id,
      gateway: r.gateway,
      amount: Number(r.amount),
      paidAt: r.paidAt!.getTime(),
      reference: r.id.slice(-6).toUpperCase(),
      mine: r.createdById === access.id,
    })),
  });
}

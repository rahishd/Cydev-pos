import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { verifyExpenseToken } from "@/lib/invoice-link";
import { buildExpenseVoucherPdf, voucherNo } from "@/lib/expense-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!token || !verifyExpenseToken(id, token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const e = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      amount: true,
      paymentMethod: true,
      status: true,
      description: true,
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!e) return new NextResponse("Not found", { status: 404 });

  await getSettings();
  const doc = buildExpenseVoucherPdf({
    id: e.id,
    date: e.date,
    categoryName: e.category.name,
    description: e.description,
    amount: Number(e.amount),
    paymentMethod: e.paymentMethod,
    status: e.status,
    createdByName: e.createdBy.name,
  });

  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${voucherNo(e.id)}.pdf"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}

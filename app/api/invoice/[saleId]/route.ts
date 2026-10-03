import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { verifyInvoiceToken } from "@/lib/invoice-link";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  const { saleId } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";

  if (!token || !verifyInvoiceToken(saleId, token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      invoiceNo: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true,
      amountPaid: true,
      customer: { select: { name: true, phone: true, address: true } },
      payments: { select: { method: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          discount: true,
          total: true,
          productVariant: {
            select: { size: true, color: true, product: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!sale) return new NextResponse("Not found", { status: 404 });

  const settings = await getSettings();
  if (!settings.invoice.enablePdf) return new NextResponse("Not found", { status: 404 });
  const doc = buildInvoicePdf({
    invoiceNo: sale.invoiceNo,
    date: sale.createdAt,
    customer: sale.customer
      ? {
          name: sale.customer.name,
          phone: sale.customer.phone ?? undefined,
          address: sale.customer.address ?? undefined,
        }
      : null,
    items: sale.items.map((i) => ({
      name: i.productVariant.product.name,
      variant: [i.productVariant.size, i.productVariant.color].filter(Boolean).join(" / "),
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount),
      total: Number(i.total),
    })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax),
    total: Number(sale.total),
    paid: Number(sale.amountPaid),
    method: Array.from(new Set(sale.payments.map((p) => p.method))).join(", "),
  });

  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sale.invoiceNo}.pdf"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}

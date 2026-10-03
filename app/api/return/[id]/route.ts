import { NextRequest, NextResponse } from "next/server";
import { verifyReturnToken } from "@/lib/invoice-link";
import { loadReturnReceipt } from "@/lib/return-data";
import { buildReturnPdf } from "@/lib/return-pdf";

export const dynamic = "force-dynamic";

/** The signed link behind "Download" and the WhatsApp message. Anyone with the link can open it, like the invoice links. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!token || !verifyReturnToken(id, token)) return new NextResponse("Not found", { status: 404 });

  const data = await loadReturnReceipt(id);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const doc = buildReturnPdf(data);
  const disposition = request.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";
  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${data.returnNo}.pdf"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}

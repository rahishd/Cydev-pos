"use server";

import { headers } from "next/headers";
import { assertPermission } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { returnToken } from "@/lib/invoice-link";
import { loadReturnReceipt } from "@/lib/return-data";

export type ReturnShareInfo = {
  url: string;
  downloadUrl: string;
  phone: string;
  customerName: string;
  returnNo: string;
  type: "RETURN" | "EXCHANGE";
  invoiceNo: string;
  amount: number;
  refunded: boolean;
  refundMethod: string;
};

/** Signed links for one return or exchange receipt, plus what the WhatsApp message needs. */
export async function getReturnShareInfo(returnId: string): Promise<ReturnShareInfo> {
  const access = await assertPermission("sales.share");
  const data = await loadReturnReceipt(returnId);
  if (!data) throw new Error("That return no longer exists.");

  await logAudit({
    actor: access,
    action: "invoice_shared",
    title: data.type === "RETURN" ? "Return Receipt Shared" : "Exchange Receipt Shared",
    module: "Sales",
    entityType: "SaleReturn",
    entityId: returnId,
    description: `Shared ${data.type === "RETURN" ? "return" : "exchange"} receipt ${data.returnNo} for ${data.invoiceNo}`,
  });

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const url = `${origin}/api/return/${returnId}?t=${returnToken(returnId)}`;

  return {
    url,
    downloadUrl: `${url}&dl=1`,
    phone: data.customer?.phone ?? "",
    customerName: data.customerName ?? "",
    returnNo: data.returnNo,
    type: data.type,
    invoiceNo: data.invoiceNo,
    amount: data.amount,
    refunded: data.refunded,
    refundMethod: data.refundMethod,
  };
}

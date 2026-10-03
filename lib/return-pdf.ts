import { jsPDF } from "jspdf";
import { letterhead, pdfFooter } from "@/lib/expense-pdf";

export type ReturnReceiptData = {
  returnNo: string;
  type: "RETURN" | "EXCHANGE";
  date: Date | string;
  invoiceNo: string;
  invoiceDate: Date | string;
  customer: { name: string; phone?: string } | null;
  item: { name: string; variant: string; quantity: number; unitPaid: number };
  /** Value of the goods that came back. */
  amount: number;
  refundMethod: string;
  /** True when money or store credit went back to the customer. */
  refunded: boolean;
  reason: string;
  /** Exchanges only: positive = customer paid more, negative = shop paid back. */
  priceDifference: number | null;
  newItem: string | null;
  processedBy: string | null;
};

type RGB = [number, number, number];
const TEXT: RGB = [24, 24, 27];
const MUTED: RGB = [113, 113, 122];
const LINE: RGB = [228, 228, 231];
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];
const W = 210;
const M = 16;
const R = W - M;

export const money = (n: number) => "NPR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
export const returnNumber = (id: string) => `RET-${id.slice(-6).toUpperCase()}`;
export const reasonLabel = (r: string) => r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const refundMethodLabel = (m: string, type: "RETURN" | "EXCHANGE") =>
  m === "STORE_CREDIT" ? "Store credit" : type === "EXCHANGE" ? "Cash (difference)" : "Cash refund";

export function buildReturnPdf(d: ReturnReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const isReturn = d.type === "RETURN";
  let y = letterhead(doc, isReturn ? "RETURN RECEIPT" : "EXCHANGE RECEIPT", [
    ["Receipt No", d.returnNo],
    ["Date", fmtDate(d.date)],
    ["Original Invoice", d.invoiceNo],
  ]);

  // Status badge
  const label = d.refunded ? (d.refundMethod === "STORE_CREDIT" ? "CREDIT ISSUED" : "REFUNDED") : "NO REFUND";
  const color = d.refunded ? GREEN : RED;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("REFUND STATUS", R, y, { align: "right" });
  doc.setFillColor(...color).roundedRect(R - 34, y + 2.5, 34, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  doc.text(label, R - 17, y + 8.1, { align: "center" });

  // Customer
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("CUSTOMER", M, y);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXT);
  doc.text(d.customer?.name || "Walk-in customer", M, y + 6);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  let cy = y + 11;
  if (d.customer?.phone) {
    doc.text(`Phone: ${d.customer.phone}`, M, cy);
    cy += 5;
  }
  doc.text(`Sold on ${fmtDate(d.invoiceDate)}`, M, cy);
  y = Math.max(cy, y + 12) + 10;

  // Item table
  doc.setFillColor(244, 244, 245).rect(M, y - 4.5, R - M, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...TEXT);
  doc.text(isReturn ? "ITEM RETURNED" : "ITEM RETURNED", M + 2, y);
  doc.text("QTY", R - 62, y, { align: "right" });
  doc.text("PAID EACH", R - 32, y, { align: "right" });
  doc.text("VALUE", R - 2, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT);
  doc.text(doc.splitTextToSize(d.item.name, 80)[0], M + 2, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(String(d.item.quantity), R - 62, y, { align: "right" });
  doc.text(money(d.item.unitPaid), R - 32, y, { align: "right" });
  doc.text(money(d.amount), R - 2, y, { align: "right" });
  if (d.item.variant) {
    doc.setFontSize(8.5).setTextColor(...MUTED);
    doc.text(d.item.variant, M + 2, y + 4.5);
    y += 4.5;
  }
  y += 5;
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y, R, y);
  y += 8;

  const row = (k: string, v: string, bold = false) => {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...MUTED);
    doc.text(k, M, y);
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 9.5).setTextColor(...TEXT);
    doc.text(v, R, y, { align: "right" });
    y += bold ? 7 : 6;
  };

  row("Type", isReturn ? "Return" : "Exchange");
  row("Reason", d.reason ? reasonLabel(d.reason) : "-");
  if (!isReturn) {
    row("Exchanged for", d.newItem || "-");
    const diff = d.priceDifference ?? 0;
    row(diff > 0 ? "Customer paid extra" : diff < 0 ? "Paid back to customer" : "Price difference", money(Math.abs(diff)));
  }
  if (d.refunded) row("Refund method", refundMethodLabel(d.refundMethod, d.type));
  if (d.processedBy) row("Processed by", d.processedBy);
  y += 2;
  doc.setDrawColor(...LINE).line(M, y, R, y);
  y += 8;
  row(isReturn ? "Amount refunded" : "Value of goods returned", isReturn ? (d.refunded ? money(d.amount) : money(0)) : money(d.amount), true);

  y += 8;
  doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...MUTED);
  doc.text("Thank you. Please keep this receipt for your records.", M, y);

  pdfFooter(doc);
  return doc;
}

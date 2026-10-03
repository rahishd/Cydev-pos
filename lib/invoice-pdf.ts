import { jsPDF } from "jspdf";
import { SHOP_INFO, contactLine, shopLogo } from "@/lib/shop-info";

export type InvoiceData = {
  invoiceNo: string;
  date: Date | string;
  customer?: { name?: string; phone?: string; address?: string } | null;
  items: Array<{
    name: string;
    variant?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  method?: string;
};

const money = (n: number) =>
  "NPR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACCENT: [number, number, number] = [234, 88, 12];
const TEXT: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const LINE: [number, number, number] = [228, 228, 231];

export function buildInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;
  const R = W - M;
  const due = Math.max(0, data.total - data.paid);
  const isPaid = due <= 0.001;
  let y = 20;

  // Header: logo + shop
  const LOGO = 30;
  const logo = shopLogo();
  if (logo) doc.addImage(logo.data, logo.format, M, y - 6, LOGO, LOGO);
  const tx = logo ? M + LOGO + 5 : M;
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...TEXT);
  doc.text(SHOP_INFO.name, tx, y + 1);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  let sy = y + 7;
  for (const l of SHOP_INFO.addressLines) {
    doc.text(l, tx, sy);
    sy += 4.5;
  }
  doc.text(`Phone: ${SHOP_INFO.phone}`, tx, sy);
  sy += 4.5;
  if (SHOP_INFO.email) {
    doc.text(SHOP_INFO.email, tx, sy);
    sy += 4.5;
  }
  if (SHOP_INFO.showPanVat && SHOP_INFO.panVat) {
    doc.text(`PAN/VAT: ${SHOP_INFO.panVat}`, tx, sy);
    sy += 4.5;
  }
  if (SHOP_INFO.registrationNo) {
    doc.text(`Reg. No: ${SHOP_INFO.registrationNo}`, tx, sy);
    sy += 4.5;
  }
  sy -= 4.5;

  // Header: invoice meta
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...ACCENT);
  doc.text("INVOICE", R, y, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text("Invoice No", R - 38, y + 8, { align: "right" });
  doc.text("Date", R - 38, y + 13, { align: "right" });
  doc.setFont("helvetica", "bold").setTextColor(...TEXT);
  doc.text(data.invoiceNo, R, y + 8, { align: "right" });
  doc.text(
    new Date(data.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    R,
    y + 13,
    { align: "right" }
  );

  y = Math.max(sy, y - 6 + LOGO) + 8;
  doc.setDrawColor(...LINE).setLineWidth(0.4).line(M, y, R, y);
  y += 8;

  // Bill to + payment status
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("BILL TO", M, y);
  doc.setFontSize(11).setTextColor(...TEXT);
  doc.text(data.customer?.name || "Walk-in Customer", M, y + 6);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  let cy = y + 11;
  if (data.customer?.phone) {
    doc.text(`Phone: ${data.customer.phone}`, M, cy);
    cy += 4.5;
  }
  if (data.customer?.address) {
    doc.text(data.customer.address, M, cy);
    cy += 4.5;
  }

  // Status badge
  const badge = isPaid ? "PAID" : "DUE";
  const color: [number, number, number] = isPaid ? [22, 163, 74] : [220, 38, 38];
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("PAYMENT STATUS", R, y, { align: "right" });
  doc.setFillColor(...color).roundedRect(R - 24, y + 2.5, 24, 8, 1.5, 1.5, "F");
  doc.setFontSize(10).setTextColor(255, 255, 255);
  doc.text(badge, R - 12, y + 8, { align: "center" });
  if (data.method) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`Method: ${data.method.replace(/_/g, " ")}`, R, y + 15, { align: "right" });
  }

  y = Math.max(cy, y + 18) + 6;

  // Table header
  const cNo = M + 2;
  const cDesc = M + 12;
  const cQty = R - 82;
  const cRate = R - 42;
  const cAmt = R - 2;
  const drawTableHead = () => {
    doc.setFillColor(244, 244, 245).rect(M, y, R - M, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
    doc.text("#", cNo, y + 5.3);
    doc.text("DESCRIPTION", cDesc, y + 5.3);
    doc.text("QTY", cQty, y + 5.3, { align: "right" });
    doc.text("RATE", cRate, y + 5.3, { align: "right" });
    doc.text("AMOUNT", cAmt, y + 5.3, { align: "right" });
    y += 8;
  };
  drawTableHead();

  data.items.forEach((it, i) => {
    const rowH = it.variant || it.discount > 0 ? 11 : 8;
    if (y + rowH > 250) {
      doc.addPage();
      y = 20;
      drawTableHead();
    }
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(String(i + 1), cNo, y + 5.5);
    doc.setFont("helvetica", "bold").setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(it.name, 82)[0], cDesc, y + 5.5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    const sub = [it.variant, it.discount > 0 ? `Discount ${money(it.discount)}` : ""]
      .filter(Boolean)
      .join("  |  ");
    if (sub) doc.text(sub, cDesc, y + 9.5);
    doc.setFontSize(9).setTextColor(...TEXT);
    doc.text(String(it.quantity), cQty, y + 5.5, { align: "right" });
    doc.text(money(it.unitPrice), cRate, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(money(it.total), cAmt, y + 5.5, { align: "right" });
    y += rowH;
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, y, R, y);
  });

  // Totals
  if (y + 50 > 280) {
    doc.addPage();
    y = 20;
  }
  y += 8;
  const lx = R - 70;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9.5);
    doc.setTextColor(...(bold ? TEXT : MUTED));
    doc.text(label, lx, y);
    doc.setTextColor(...TEXT);
    doc.text(value, R - 2, y, { align: "right" });
    y += 6;
  };
  row("Subtotal", money(data.subtotal));
  if (data.discount > 0) row("Discount", "- " + money(data.discount));
  if (data.tax > 0) row("Tax", money(data.tax));
  doc.setDrawColor(...LINE).line(lx, y - 3, R, y - 3);
  y += 1;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ACCENT);
  doc.text("Total", lx, y);
  doc.text(money(data.total), R - 2, y, { align: "right" });
  y += 8;
  row("Paid", money(Math.min(data.paid, data.total)));
  if (!isPaid) {
    doc.setFillColor(254, 242, 242).roundedRect(lx - 3, y - 5, 73, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(220, 38, 38);
    doc.text("Amount Due", lx, y + 1);
    doc.text(money(due), R - 2, y + 1, { align: "right" });
    y += 10;
  }

  // Return policy & terms
  const notes: [string, string][] = [
    ["RETURN POLICY", SHOP_INFO.returnPolicy],
    ["TERMS & CONDITIONS", SHOP_INFO.terms],
  ];
  y += 6;
  for (const [title, body] of notes) {
    if (!body) continue;
    const lines = doc.splitTextToSize(body, R - M) as string[];
    if (y + 6 + lines.length * 3.8 > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(title, M, y);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(lines, M, y + 4);
    y += 6 + lines.length * 3.8;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE).setLineWidth(0.4).line(M, 276, R, 276);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(SHOP_INFO.footer || SHOP_INFO.name, W / 2, 283, { align: "center" });
    doc.setFontSize(7.5);
    doc.text(contactLine(), W / 2, 288, { align: "center" });
  }

  return doc;
}

export function downloadInvoicePdf(data: InvoiceData) {
  buildInvoicePdf(data).save(`${data.invoiceNo}.pdf`);
}

export function normalizeWhatsAppNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === 10 ? `977${digits}` : digits.replace(/^00/, "");
}

// Opens the customer's chat in the WhatsApp app with a message containing the invoice PDF link.
export function openWhatsAppChat(data: InvoiceData, contact: string, invoiceUrl: string) {
  const due = Math.max(0, data.total - data.paid);
  const paid = Math.min(data.paid, data.total);
  const text = [
    `Hello${data.customer?.name ? " " + data.customer.name : ""}, thank you for shopping at ${SHOP_INFO.name}.`,
    "",
    `*Invoice ${data.invoiceNo}*`,
    `Total: ${money(data.total)}`,
    `Paid: ${money(paid)}`,
    due > 0.001
      ? `Payment Status: *DUE*
Amount Due: *${money(due)}*`
      : "Payment Status: *PAID*",
    "",
    "Tap the link below to view or download your invoice (PDF):",
    invoiceUrl,
    "",
    SHOP_INFO.footer,
  ].join("\n");

  window.location.href = `whatsapp://send?phone=${normalizeWhatsAppNumber(contact)}&text=${encodeURIComponent(text)}`;
}

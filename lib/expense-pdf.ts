import { jsPDF } from "jspdf";
import { SHOP_INFO, contactLine, shopLogo } from "@/lib/shop-info";
import { normalizeWhatsAppNumber } from "@/lib/invoice-pdf";

export type ExpenseRow = {
  id: string;
  date: Date | string;
  categoryName: string;
  description: string | null;
  amount: number;
  paymentMethod: string;
  status: string;
  createdByName: string;
};

export type ExpenseReportData = {
  expenses: ExpenseRow[];
  periodLabel: string;
  filterLabel?: string;
};

type RGB = [number, number, number];

const money = (n: number) =>
  "NPR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACCENT: RGB = [234, 88, 12];
const TEXT: RGB = [24, 24, 27];
const MUTED: RGB = [113, 113, 122];
const LINE: RGB = [228, 228, 231];
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];
const W = 210;
const M = 16;
const R = W - M;

export const voucherNo = (id: string) => `EXP-${id.slice(-6).toUpperCase()}`;
const methodLabel = (m: string) =>
  m.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

function letterhead(doc: jsPDF, title: string, meta: [string, string][]): number {
  const y = 20;
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

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ACCENT);
  doc.text(title, R, y, { align: "right" });
  let my = y + 8;
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(k, R - 38, my, { align: "right" });
    doc.setFont("helvetica", "bold").setTextColor(...TEXT);
    doc.text(v, R, my, { align: "right" });
    my += 5;
  }

  const bottom = Math.max(sy, y - 6 + LOGO) + 8;
  doc.setDrawColor(...LINE).setLineWidth(0.4).line(M, bottom, R, bottom);
  return bottom + 8;
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE).setLineWidth(0.4).line(M, 276, R, 276);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(contactLine(), W / 2, 283, { align: "center" });
    if (pages > 1) doc.text(`Page ${p} of ${pages}`, R, 288, { align: "right" });
  }
}

function badge(doc: jsPDF, label: string, color: RGB, x: number, y: number) {
  doc.setFillColor(...color).roundedRect(x, y, 24, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  doc.text(label, x + 12, y + 5.6, { align: "center" });
}

export function buildExpenseVoucherPdf(e: ExpenseRow): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = letterhead(doc, "EXPENSE VOUCHER", [
    ["Voucher No", voucherNo(e.id)],
    ["Date", fmtDate(e.date)],
  ]);

  const paid = e.status === "PAID";
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("PAYMENT STATUS", R, y, { align: "right" });
  badge(doc, paid ? "PAID" : "UNPAID", paid ? GREEN : RED, R - 24, y + 2.5);

  const rows: [string, string][] = [
    ["Category", e.categoryName],
    ["Description", e.description || "-"],
    ["Payment Method", methodLabel(e.paymentMethod)],
    ["Recorded By", e.createdByName],
  ];
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
  doc.text("EXPENSE DETAILS", M, y);
  y += 8;
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...MUTED);
    doc.text(k, M, y);
    doc.setFont("helvetica", "bold").setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(v, 110)[0], M + 45, y);
    y += 3;
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, y, R, y);
    y += 6;
  }

  y += 4;
  doc.setFillColor(255, 247, 237).roundedRect(M, y, R - M, 22, 2, 2, "F");
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
  doc.text("Amount", M + 6, y + 13);
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ACCENT);
  doc.text(money(e.amount), R - 6, y + 14, { align: "right" });

  footer(doc);
  return doc;
}

export function summarize(expenses: ExpenseRow[]) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = expenses.filter((e) => e.status === "UNPAID").reduce((s, e) => s + e.amount, 0);
  return { total, unpaid, paid: total - unpaid, count: expenses.length };
}

export function buildExpenseReportPdf(data: ExpenseReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sorted = [...data.expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const s = summarize(sorted);

  let y = letterhead(doc, "EXPENSE REPORT", [
    ["Period", data.periodLabel],
    ["Generated", fmtDate(new Date())],
    ["Entries", String(s.count)],
  ]);

  if (data.filterLabel) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
    doc.text(`Filters: ${data.filterLabel}`, M, y - 2);
    y += 4;
  }

  const cardW = (R - M - 8) / 3;
  const cards: [string, number, RGB][] = [
    ["TOTAL EXPENSES", s.total, ACCENT],
    ["PAID", s.paid, GREEN],
    ["UNPAID", s.unpaid, RED],
  ];
  cards.forEach(([label, value, color], i) => {
    const x = M + i * (cardW + 4);
    doc.setFillColor(250, 250, 250).setDrawColor(...LINE).setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(label, x + 4, y + 6);
    doc.setFontSize(12).setTextColor(...color);
    doc.text(money(value), x + 4, y + 14);
  });
  y += 26;

  const cDate = M + 2;
  const cCat = M + 24;
  const cDesc = M + 62;
  const cMethod = R - 64;
  const cStatus = R - 44;
  const cAmt = R - 2;
  const head = () => {
    doc.setFillColor(244, 244, 245).rect(M, y, R - M, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
    doc.text("DATE", cDate, y + 5.3);
    doc.text("CATEGORY", cCat, y + 5.3);
    doc.text("DESCRIPTION", cDesc, y + 5.3);
    doc.text("METHOD", cMethod, y + 5.3);
    doc.text("STATUS", cStatus, y + 5.3);
    doc.text("AMOUNT", cAmt, y + 5.3, { align: "right" });
    y += 8;
  };
  head();

  if (sorted.length === 0) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("No expenses in this period.", W / 2, y + 10, { align: "center" });
    y += 16;
  }

  for (const e of sorted) {
    if (y + 8 > 265) {
      doc.addPage();
      y = 20;
      head();
    }
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TEXT);
    doc.text(new Date(e.date).toLocaleDateString("en-GB"), cDate, y + 5.3);
    doc.text(doc.splitTextToSize(e.categoryName, 36)[0], cCat, y + 5.3);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(e.description || "-", cMethod - cDesc - 3)[0], cDesc, y + 5.3);
    doc.setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(methodLabel(e.paymentMethod), 17)[0], cMethod, y + 5.3);
    doc.setFont("helvetica", "bold").setTextColor(...(e.status === "PAID" ? GREEN : RED));
    doc.text(e.status, cStatus, y + 5.3);
    doc.setTextColor(...TEXT);
    doc.text(money(e.amount), cAmt, y + 5.3, { align: "right" });
    y += 8;
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, y, R, y);
  }

  const byCat = new Map<string, number>();
  for (const e of sorted) byCat.set(e.categoryName, (byCat.get(e.categoryName) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  if (y + 20 + cats.length * 6 > 270) {
    doc.addPage();
    y = 20;
  }
  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ACCENT);
  doc.text("Total", R - 70, y);
  doc.text(money(s.total), R - 2, y, { align: "right" });

  if (cats.length > 1) {
    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
    doc.text("BY CATEGORY", M, y);
    y += 5;
    for (const [name, amt] of cats) {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...TEXT);
      doc.text(name, M, y);
      doc.text(`${money(amt)}  (${Math.round((amt / s.total) * 100)}%)`, M + 95, y, {
        align: "right",
      });
      y += 5.5;
    }
  }

  footer(doc);
  return doc;
}

export function downloadExpenseVoucher(e: ExpenseRow) {
  buildExpenseVoucherPdf(e).save(`${voucherNo(e.id)}.pdf`);
}

export function downloadExpenseReport(data: ExpenseReportData) {
  buildExpenseReportPdf(data).save(`Expense-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function voucherMessage(e: ExpenseRow, url: string): string {
  return [
    `*Expense Voucher ${voucherNo(e.id)}* - ${SHOP_INFO.name}`,
    `Date: ${fmtDate(e.date)}`,
    `Category: ${e.categoryName}`,
    ...(e.description ? [`Details: ${e.description}`] : []),
    `Amount: *${money(e.amount)}*`,
    `Payment: ${methodLabel(e.paymentMethod)} (${e.status === "PAID" ? "*PAID*" : "*UNPAID*"})`,
    "",
    "Tap the link below to view or download the voucher (PDF):",
    url,
  ].join("\n");
}

export function reportMessage(data: ExpenseReportData, url: string): string {
  const s = summarize(data.expenses);
  return [
    `*Expense Report* - ${SHOP_INFO.name}`,
    `Period: ${data.periodLabel}`,
    `Entries: ${s.count}`,
    `Total: *${money(s.total)}*`,
    `Paid: ${money(s.paid)}`,
    `Unpaid: *${money(s.unpaid)}*`,
    "",
    "Tap the link below to view or download the full report (PDF):",
    url,
  ].join("\n");
}

export function openWhatsAppChat(contact: string, text: string) {
  window.location.href = `whatsapp://send?phone=${normalizeWhatsAppNumber(contact)}&text=${encodeURIComponent(text)}`;
}

import { createHmac, timingSafeEqual } from "crypto";

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

function verify(payload: string, token: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const invoiceToken = (saleId: string) => sign(`invoice:${saleId}`);
export const verifyInvoiceToken = (saleId: string, token: string) =>
  verify(`invoice:${saleId}`, token);

export const expenseToken = (id: string) => sign(`expense:${id}`);
export const verifyExpenseToken = (id: string, token: string) => verify(`expense:${id}`, token);

export type ExpenseReportFilters = {
  from?: string;
  to?: string;
  category?: string;
  method?: string;
  status?: string;
  q?: string;
};

const reportPayload = (f: ExpenseReportFilters) =>
  "expense-report:" +
  JSON.stringify([f.from ?? "", f.to ?? "", f.category ?? "", f.method ?? "", f.status ?? "", f.q ?? ""]);

export const expenseReportToken = (f: ExpenseReportFilters) => sign(reportPayload(f));
export const verifyExpenseReportToken = (f: ExpenseReportFilters, token: string) =>
  verify(reportPayload(f), token);

"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { normalizeWhatsAppNumber } from "@/lib/invoice-pdf";
import {
  downloadExpenseReport,
  downloadExpenseVoucher,
  openWhatsAppChat,
  reportMessage,
  summarize,
  voucherMessage,
  voucherNo,
  type ExpenseReportData,
  type ExpenseRow,
} from "@/lib/expense-pdf";
import {
  getExpenseReportShareUrl,
  getExpenseShareUrl,
} from "@/app/(dashboard)/expenses/actions";
import type { ExpenseReportFilters } from "@/lib/invoice-link";

export type ShareTarget =
  | { kind: "voucher"; expense: ExpenseRow }
  | { kind: "report"; data: ExpenseReportData; filters: ExpenseReportFilters };

export function ExpenseShareModal({
  target,
  onClose,
}: {
  target: ShareTarget | null;
  onClose: () => void;
}) {
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!target) return null;

  const valid = normalizeWhatsAppNumber(contact).length >= 11;
  const isVoucher = target.kind === "voucher";

  const title = isVoucher
    ? `Expense Voucher ${voucherNo(target.expense.id)}`
    : "Expense Report";

  const summary = isVoucher
    ? null
    : summarize(target.data.expenses);

  const handleDownload = () => {
    if (target.kind === "voucher") downloadExpenseVoucher(target.expense);
    else downloadExpenseReport(target.data);
  };

  const handleWhatsApp = async () => {
    setBusy(true);
    setError("");
    try {
      if (target.kind === "voucher") {
        const url = await getExpenseShareUrl(target.expense.id);
        openWhatsAppChat(contact, voucherMessage(target.expense, url));
      } else {
        const url = await getExpenseReportShareUrl(target.filters);
        openWhatsAppChat(contact, reportMessage(target.data, url));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open WhatsApp");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-zinc-50 p-3 text-sm">
          {target.kind === "voucher" ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Category</span>
                <span className="font-medium">{target.expense.categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Status</span>
                <span className="font-medium">{target.expense.status}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold">
                <span>Amount</span>
                <span className="text-accent">
                  NPR {target.expense.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Period</span>
                <span className="font-medium">{target.data.periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Entries</span>
                <span className="font-medium">{summary!.count}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold">
                <span>Total</span>
                <span className="text-accent">
                  NPR {summary!.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {summary!.unpaid > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Unpaid</span>
                  <span>
                    NPR {summary!.unpaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text">
            Contact Number (WhatsApp)
          </label>
          <input
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="98XXXXXXXX"
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleDownload} className="flex-1">
            Download PDF
          </Button>
          <Button onClick={handleWhatsApp} disabled={!valid || busy} className="flex-1">
            {busy ? "Opening..." : "Send via WhatsApp"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

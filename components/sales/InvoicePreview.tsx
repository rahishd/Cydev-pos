"use client";

import { useState } from "react";
import { useCan, useSettings } from "@/components/providers/SettingsProvider";
import { getInvoiceShareUrl } from "@/app/(dashboard)/sales/actions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OnlinePayPanel } from "@/components/sales/OnlinePaymentFlow";
import { GATEWAYS, isGateway } from "@/lib/online-pay";
import { formatCurrency } from "@/lib/date-utils";
import {
  downloadInvoicePdf,
  normalizeWhatsAppNumber,
  openWhatsAppChat,
  type InvoiceData,
} from "@/lib/invoice-pdf";

export function InvoicePreview({
  isOpen,
  onClose,
  invoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}) {
  const [contact, setContact] = useState<string>(invoice.customer?.phone ?? "");

  const can = useCan();
  const pdfEnabled = Boolean(useSettings().invoice.enablePdf) && can("sales.share");
  const [sending, setSending] = useState(false);

  // Payment state lives here so it can change while the invoice is open (QR payments arrive later).
  const [paid, setPaid] = useState<number>(invoice.amountPaid);
  const [onlineGateways, setOnlineGateways] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [showPanel] = useState(() => invoice.total - invoice.amountPaid > 0.001 && can("sales.online_payment"));
  const methods = [
    ...new Set([
      ...((invoice.payments ?? []) as { method: string }[]).map((p) => p.method),
      ...onlineGateways,
    ]),
  ];
  const methodText = methods.length
    ? methods.map((m) => (isGateway(m) ? GATEWAYS[m].label : m.replace(/_/g, " "))).join(", ")
    : invoice.method || "-";

  const pdfData = (): InvoiceData => ({
    invoiceNo: invoice.invoiceNo,
    date: invoice.createdAt,
    customer: invoice.customer
      ? { name: invoice.customer.name, phone: contact || invoice.customer.phone, address: invoice.customer.address }
      : contact
        ? { phone: contact }
        : null,
    items: invoice.items.map((i: any) => ({
      name: i.productName,
      variant: [i.size, i.color].filter(Boolean).join(" / "),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      total: i.quantity * i.unitPrice - i.discount,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    total: invoice.total,
    paid,
    method: methods.join(", ") || invoice.method,
  });

  const validContact = normalizeWhatsAppNumber(contact).length >= 11;

  const handleWhatsApp = async () => {
    setSending(true);
    try {
      const url = await getInvoiceShareUrl(invoice.id);
      openWhatsAppChat(pdfData(), contact, url);
    } finally {
      setSending(false);
    }
  };

  const outstanding = invoice.total - paid;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice #${invoice.invoiceNo}`} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Success Message */}
        <div className={`p-3 border rounded text-center ${outstanding > 0.001 ? "bg-amber-50 border-amber-300" : "bg-green-50 border-success/20"}`}>
          <div className={`text-sm font-semibold ${outstanding > 0.001 ? "text-amber-700" : "text-success"}`}>
            {outstanding > 0.001 ? "Sale created: payment pending" : "Sale Completed ✓"}
          </div>
          <div className="text-xs text-text-muted mt-1">Invoice #{invoice.invoiceNo}</div>
        </div>

        {/* Header */}
        <Card className="p-3">
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-text">Invoice #{invoice.invoiceNo}</div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Date</span>
              <span>{new Date(invoice.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Staff</span>
              <span>{invoice.staffName}</span>
            </div>
          </div>
        </Card>

        {/* Customer */}
        {invoice.customer && (
          <Card className="p-3">
            <div className="text-xs">
              <div className="font-semibold text-text mb-1">Customer</div>
              <div className="text-text">{invoice.customer.name}</div>
              {invoice.customer.phone && (
                <div className="text-text-muted">{invoice.customer.phone}</div>
              )}
            </div>
          </Card>
        )}

        {/* Items */}
        <div>
          <div className="text-xs font-semibold text-text mb-2">Items</div>
          <div className="space-y-2">
            {invoice.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-xs px-2 py-1 bg-zinc-50 rounded">
                <div>
                  <div className="font-medium text-text">{item.productName}</div>
                  <div className="text-text-muted">
                    {item.size && `${item.size}`}
                    {item.size && item.color && " / "}
                    {item.color}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {item.quantity} × NPR {formatCurrency(item.unitPrice)}
                  </div>
                  <div className="text-text-muted">
                    NPR {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <Card className="p-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Subtotal</span>
              <span>NPR {formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-text-muted">Discount</span>
                <span>- NPR {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            {invoice.tax > 0 && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-text-muted">Tax</span>
                <span>+ NPR {formatCurrency(invoice.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-accent">NPR {formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </Card>

        {/* Payment */}
        <Card className="p-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Payment Method</span>
              <span className="font-medium">{methodText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Paid</span>
              <span className="font-medium">NPR {formatCurrency(paid)}</span>
            </div>
            {outstanding !== 0 && (
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-text-muted font-semibold">
                  {outstanding > 0 ? "Outstanding" : "Change"}
                </span>
                <span className={outstanding > 0 ? "text-danger" : "text-success"}>
                  NPR {formatCurrency(Math.abs(outstanding))}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Online (QR) payment for whatever is still due */}
        {showPanel && (
          <OnlinePayPanel
            saleId={invoice.id}
            amount={Math.max(0.01, outstanding)}
            autoStart={(invoice.pendingOnline ?? 0) > 0}
            onWaitingChange={setWaiting}
            onPaid={({ gateway, applied }) => {
              setPaid((p) => p + applied);
              setOnlineGateways((g) => [...g, gateway]);
            }}
          />
        )}

        {/* WhatsApp */}
        {pdfEnabled && (
        <Card className="p-3">
          <label className="block text-xs font-semibold text-text mb-1">
            Contact Number (WhatsApp)
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="98XXXXXXXX"
              className="flex-1 px-2 py-1.5 text-sm border border-border rounded"
            />
            <Button onClick={handleWhatsApp} disabled={!validContact || sending || waiting}>
              {waiting ? "Waiting for payment..." : sending ? "Opening..." : "Send Invoice via WhatsApp"}
            </Button>
          </div>
        </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {pdfEnabled && (
            <Button variant="ghost" onClick={() => downloadInvoicePdf(pdfData())} className="flex-1">
              Download PDF
            </Button>
          )}
          <Button onClick={onClose} className="flex-1" disabled={waiting}>
            New Sale
          </Button>
        </div>
      </div>
    </Modal>
  );
}

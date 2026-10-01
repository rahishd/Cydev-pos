"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";

export function InvoicePreview({
  isOpen,
  onClose,
  invoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}) {
  const handlePrint = () => {
    window.print();
  };

  const outstanding = invoice.total - invoice.amountPaid;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice #${invoice.invoiceNo}`} size="lg">
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {/* Success Message */}
        <div className="p-3 bg-green-50 border border-success/20 rounded text-center">
          <div className="text-sm font-semibold text-success">Sale Completed ✓</div>
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
              <span className="font-medium">{invoice.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Paid</span>
              <span className="font-medium">NPR {formatCurrency(invoice.amountPaid)}</span>
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handlePrint} className="flex-1">
            🖨️ Print
          </Button>
          <Button onClick={onClose} className="flex-1">
            New Sale
          </Button>
        </div>
      </div>
    </Modal>
  );
}

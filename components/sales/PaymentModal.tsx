"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";

type Customer = {
  id: string;
  name: string;
  outstanding: number;
};

export function PaymentModal({
  isOpen,
  onClose,
  total,
  customer,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  customer: Customer | null;
  onComplete: (data: any) => void;
}) {
  const [method, setMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState(total.toString());
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const balance = total - Number(amountPaid);

  const handleComplete = () => {
    if (!amountPaid || Number(amountPaid) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (method === "CREDIT" && !customer) {
      alert("Please select a customer for credit sale");
      return;
    }

    onComplete({
      method,
      amountPaid: Number(amountPaid),
      dueDate: method === "CREDIT" ? new Date(dueDate) : undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment" size="md">
      <div className="space-y-4">
        <Card className="bg-zinc-50 p-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Total Amount</span>
              <span className="font-bold text-accent">NPR {formatCurrency(total)}</span>
            </div>
            {customer && (
              <div className="flex justify-between">
                <span className="text-text-muted">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
            )}
          </div>
        </Card>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Payment Method *</label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="ESEWA">eSewa</option>
            <option value="KHALTI">Khalti</option>
            <option value="FONEPAY">Fonepay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CARD">Card</option>
            {customer && <option value="CREDIT">Credit</option>}
            <option value="OTHER">Other</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Amount Paid (NPR) *</label>
          <Input
            type="number"
            min="0"
            max={total}
            step="100"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
        </div>

        {method === "CREDIT" && (
          <div>
            <label className="block text-sm font-medium text-text mb-2">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}

        {Number(amountPaid) > 0 && (
          <Card className="bg-green-50 border border-success/20 p-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Amount Paid</span>
                <span className="font-medium">NPR {formatCurrency(Number(amountPaid))}</span>
              </div>
              {balance !== 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">
                    {balance > 0 ? "Balance" : "Overpaid"}
                  </span>
                  <span className="font-medium">
                    NPR {formatCurrency(Math.abs(balance))}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleComplete} className="flex-1">
            Complete Sale
          </Button>
        </div>
      </div>
    </Modal>
  );
}

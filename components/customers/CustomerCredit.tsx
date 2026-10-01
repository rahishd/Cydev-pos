"use client";

import { useState } from "react";
import { recordCustomerPayment } from "@/app/(dashboard)/customers/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/date-utils";

export function CustomerCredit({
  credits,
  customerId,
}: {
  credits: any[];
  customerId: string;
}) {
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);

  const totalCredit = credits.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalPaid = credits.reduce((sum, c) => sum + Number(c.amountPaid), 0);
  const outstanding = totalCredit - totalPaid;

  const handleRecordPayment = async () => {
    if (!selectedCredit || !amount || Number(amount) <= 0) {
      alert("Please select credit and enter amount");
      return;
    }

    const creditOutstanding = Number(selectedCredit.amount) - Number(selectedCredit.amountPaid);
    if (Number(amount) > creditOutstanding) {
      alert(`Maximum payment is NPR ${formatCurrency(creditOutstanding)}`);
      return;
    }

    setLoading(true);
    try {
      await recordCustomerPayment(
        customerId,
        selectedCredit.id,
        Number(amount),
        method
      );

      // Update local state
      setSelectedCredit({
        ...selectedCredit,
        amountPaid: Number(selectedCredit.amountPaid) + Number(amount),
      });

      alert("Payment recorded successfully!");
      setAmount("");
      setMethod("CASH");
      setShowPaymentModal(false);
    } catch (err) {
      console.error("Payment failed:", err);
      alert(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (credits.length === 0) {
    return (
      <Card className="p-4 text-center text-text-muted">
        No outstanding credit
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL CREDIT</div>
          <div className="text-2xl font-bold text-text">
            NPR {formatCurrency(totalCredit)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL PAID</div>
          <div className="text-2xl font-bold text-success">
            NPR {formatCurrency(totalPaid)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">OUTSTANDING</div>
          <div className={`text-2xl font-bold ${outstanding > 0 ? "text-danger" : "text-success"}`}>
            NPR {formatCurrency(outstanding)}
          </div>
        </Card>
      </div>

      {/* Credit Transactions */}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Invoice</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Date</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Total</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Paid</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Outstanding</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Due Date</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Status</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((credit) => {
              const outstandingAmount = Number(credit.amount) - Number(credit.amountPaid);
              const isPending = outstandingAmount > 0;
              const isDue = credit.dueDate && new Date(credit.dueDate) < new Date();

              return (
                <tr key={credit.id} className="border-b border-border hover:bg-zinc-50">
                  <td className="py-2 px-2 font-medium text-accent">
                    {credit.invoiceRef || "-"}
                  </td>
                  <td className="py-2 px-2 text-text-muted">
                    {new Date(credit.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2 text-right font-medium">
                    NPR {formatCurrency(Number(credit.amount))}
                  </td>
                  <td className="py-2 px-2 text-right text-text">
                    NPR {formatCurrency(Number(credit.amountPaid))}
                  </td>
                  <td className={`py-2 px-2 text-right font-medium ${
                    outstandingAmount > 0 ? "text-danger" : "text-success"
                  }`}>
                    NPR {formatCurrency(outstandingAmount)}
                  </td>
                  <td className="py-2 px-2 text-xs text-text-muted">
                    {credit.dueDate
                      ? new Date(credit.dueDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      !isPending
                        ? "bg-success/20 text-success"
                        : isDue
                        ? "bg-danger/20 text-danger"
                        : "bg-warning/20 text-warning"
                    }`}>
                      {!isPending ? "Paid" : isDue ? "Overdue" : "Pending"}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    {isPending && (
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => {
                          setSelectedCredit(credit);
                          setShowPaymentModal(true);
                        }}
                      >
                        Pay
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal && selectedCredit && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedCredit(null);
          }}
          title={`Record Payment - ${selectedCredit.invoiceRef || "Credit"}`}
          size="md"
        >
          <div className="space-y-4">
            <Card className="bg-zinc-50 p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Credit</span>
                  <span className="font-medium">
                    NPR {formatCurrency(Number(selectedCredit.amount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Already Paid</span>
                  <span className="font-medium">
                    NPR {formatCurrency(Number(selectedCredit.amountPaid))}
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Outstanding</span>
                  <span className="text-danger">
                    NPR{" "}
                    {formatCurrency(
                      Number(selectedCredit.amount) - Number(selectedCredit.amountPaid)
                    )}
                  </span>
                </div>
              </div>
            </Card>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Payment Amount *
              </label>
              <Input
                type="number"
                min="0"
                max={Number(selectedCredit.amount) - Number(selectedCredit.amountPaid)}
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount to pay"
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Payment Method
              </label>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowPaymentModal(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleRecordPayment} disabled={!amount || loading} className="flex-1">
                {loading ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

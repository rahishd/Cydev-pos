"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useState, useEffect } from "react";
import { recordPayment, getPurchaseDetails } from "@/app/(dashboard)/purchases/actions";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/date-utils";

type PurchaseDetails = Awaited<ReturnType<typeof getPurchaseDetails>>;

export function RecordPaymentModal({
  isOpen,
  onClose,
  purchaseId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  purchaseId: string;
  onSuccess: () => void;
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");

  useEffect(() => {
    if (isOpen && purchaseId) {
      setFetching(true);
      getPurchaseDetails(purchaseId)
        .then(setPurchase)
        .catch((err) => setError(err.message))
        .finally(() => setFetching(false));
    }
  }, [isOpen, purchaseId]);

  const handleSubmit = async () => {
    if (!session?.user?.id || !amount) {
      setError("Please enter an amount");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await recordPayment(purchaseId, Number(amount), method, session.user.id);
      onSuccess();
      onClose();
      setAmount("");
      setMethod("CASH");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !purchase) return null;

  const outstanding = Number(purchase.purchase.total) - Number(purchase.purchase.paidAmount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Payment - ${purchase.purchase.purchaseNo}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Purchase Summary */}
        <Card className="bg-zinc-50 p-3">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted">Supplier:</span>
              <span className="font-medium text-text">{purchase.purchase.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Total:</span>
              <span className="font-medium text-text">NPR {formatCurrency(Number(purchase.purchase.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Paid:</span>
              <span className="font-medium text-text">NPR {formatCurrency(Number(purchase.purchase.paidAmount))}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-text-muted font-semibold">Outstanding:</span>
              <span className="font-semibold text-text">NPR {formatCurrency(outstanding)}</span>
            </div>
          </div>
        </Card>

        {/* Payment Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Amount *</label>
            <Input
              type="number"
              min="0"
              max={outstanding}
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to NPR ${formatCurrency(outstanding)}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">Payment Method</label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </Select>
          </div>

          {amount && (
            <Card className="bg-green-50 p-3">
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-text-muted">Payment:</span>
                  <span className="font-medium text-text">NPR {formatCurrency(Number(amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Remaining:</span>
                  <span className="font-medium text-text">
                    NPR {formatCurrency(Math.max(0, outstanding - Number(amount)))}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!amount || loading} className="flex-1">
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

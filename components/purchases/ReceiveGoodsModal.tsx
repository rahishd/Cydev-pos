"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useState, useEffect } from "react";
import { receiveGoods, getPurchaseDetails } from "@/app/(dashboard)/purchases/actions";
import { useSession } from "next-auth/react";

type PurchaseDetails = Awaited<ReturnType<typeof getPurchaseDetails>>;

export function ReceiveGoodsModal({
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
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen && purchaseId) {
      setFetching(true);
      getPurchaseDetails(purchaseId)
        .then((p) => {
          setPurchase(p);
          // Initialize received quantities with zeros
          const initial: Record<string, number> = {};
          p.purchase.purchaseItems.forEach((item) => {
            initial[item.id] = 0;
          });
          setReceivedQtys(initial);
        })
        .catch((err) => setError(err.message))
        .finally(() => setFetching(false));
    }
  }, [isOpen, purchaseId]);

  const handleSubmit = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError("");

    try {
      const items = Object.entries(receivedQtys).map(([itemId, qty]) => ({
        itemId,
        receivedQuantity: qty,
      }));

      await receiveGoods(purchaseId, items, session.user.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive goods");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !purchase) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Receive Goods - ${purchase.purchase.purchaseNo}`} size="lg">
      <div className="space-y-6">
        <Card className="bg-zinc-50 p-3">
          <div className="text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-text-muted">Supplier:</span>
              <span className="font-medium text-text">{purchase.purchase.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Date:</span>
              <span className="font-medium text-text">
                {new Date(purchase.purchase.date).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Items */}
        <div>
          <h3 className="font-semibold text-text mb-3">Receive Items</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {purchase.purchase.purchaseItems.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Product</label>
                    <div className="font-medium text-text">
                      {item.productVariant.product.name}
                      {item.productVariant.size && ` / ${item.productVariant.size}`}
                      {item.productVariant.color && ` / ${item.productVariant.color}`}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Ordered</label>
                    <div className="font-medium text-text">{item.quantity}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Receive Now
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={receivedQtys[item.id] || 0}
                      onChange={(e) =>
                        setReceivedQtys({
                          ...receivedQtys,
                          [item.id]: Math.min(parseInt(e.target.value) || 0, item.quantity),
                        })
                      }
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Summary */}
        {purchase.purchase.purchaseItems.length > 0 && (
          <Card className="bg-green-50 border border-success/20 p-3">
            <div className="text-sm space-y-1">
              {purchase.purchase.purchaseItems.map((item) => {
                const received = receivedQtys[item.id] || 0;
                if (received === 0) return null;
                return (
                  <div key={item.id} className="flex justify-between text-text">
                    <span>
                      {item.productVariant.product.name}
                      {item.productVariant.size && ` / ${item.productVariant.size}`}
                    </span>
                    <span className="font-medium">+{received}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? "Confirming..." : "Confirm Receipt"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

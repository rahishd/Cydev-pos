"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { getVariantDetails } from "@/app/(dashboard)/inventory/actions";

type VariantDetails = Awaited<ReturnType<typeof getVariantDetails>>;

export function InventoryDetailModal({
  isOpen,
  onClose,
  variantId,
  onAdjustClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  variantId?: string;
  onAdjustClick: () => void;
}) {
  const [data, setData] = useState<VariantDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && variantId) {
      setLoading(true);
      getVariantDetails(variantId)
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [isOpen, variantId]);

  if (!data || loading) return <Modal isOpen={isOpen} onClose={onClose} />;

  const { variant, stockSummary, inventoryValue } = data;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${variant.product.name} - ${[variant.size, variant.color].filter(Boolean).join(" / ")}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Top Info */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-zinc-50 p-4">
          <div>
            <div className="text-xs font-medium text-text-muted">SKU</div>
            <div className="font-mono text-sm font-semibold text-text">{variant.sku}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">Current Stock</div>
            <div className="text-sm font-semibold text-text">{variant.quantity}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">Minimum Stock</div>
            <div className="text-sm font-semibold text-text">{variant.minStockLevel}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">Purchase Price</div>
            <div className="text-sm font-semibold text-text">NPR {formatCurrency(Number(variant.purchasePrice))}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">Selling Price</div>
            <div className="text-sm font-semibold text-text">NPR {formatCurrency(Number(variant.sellingPrice))}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">Inventory Value</div>
            <div className="text-sm font-semibold text-text">NPR {formatCurrency(inventoryValue)}</div>
          </div>
        </div>

        {/* Stock Summary */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text">Stock Summary</h3>
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Opening Stock</span>
              <span className="font-medium">{stockSummary.openingStock}</span>
            </div>
            <div className="flex justify-between text-sm text-success">
              <span className="text-text-muted">Purchased</span>
              <span className="font-medium">+{stockSummary.purchased}</span>
            </div>
            <div className="flex justify-between text-sm text-danger">
              <span className="text-text-muted">Sold</span>
              <span className="font-medium">{stockSummary.sold}</span>
            </div>
            <div className="flex justify-between text-sm text-success">
              <span className="text-text-muted">Customer Returns</span>
              <span className="font-medium">+{stockSummary.customerReturns}</span>
            </div>
            <div className="flex justify-between text-sm text-danger">
              <span className="text-text-muted">Supplier Returns</span>
              <span className="font-medium">{stockSummary.supplierReturns}</span>
            </div>
            <div className="flex justify-between text-sm text-danger">
              <span className="text-text-muted">Damaged</span>
              <span className="font-medium">{stockSummary.damaged}</span>
            </div>
            <div className="flex justify-between text-sm text-danger">
              <span className="text-text-muted">Loss</span>
              <span className="font-medium">{stockSummary.loss}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Manual Adjustment</span>
              <span className="font-medium">{stockSummary.manualAdjustment}</span>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-text">Current Stock</span>
                <span className="font-semibold text-text">{variant.quantity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button onClick={onAdjustClick} className="flex-1">
            Adjust Stock
          </Button>
        </div>
      </div>
    </Modal>
  );
}

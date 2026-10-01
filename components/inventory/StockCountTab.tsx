"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface CountItem {
  variantId: string;
  productName: string;
  variant: string;
  systemQty: number;
  physicalQty: number;
}

export function StockCountTab({
  variants,
}: {
  variants: Array<{
    id: string;
    product: { name: string };
    size?: string;
    color?: string;
    quantity: number;
  }>;
}) {
  const [countItems, setCountItems] = useState<CountItem[]>(
    variants.map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      variant: [v.size, v.color].filter(Boolean).join(" / ") || "—",
      systemQty: v.quantity,
      physicalQty: 0,
    }))
  );

  const [completed, setCompleted] = useState(false);

  const handlePhysicalQtyChange = (variantId: string, qty: number) => {
    setCountItems((items) =>
      items.map((item) =>
        item.variantId === variantId ? { ...item, physicalQty: qty } : item
      )
    );
  };

  const differences = countItems.filter((item) => item.systemQty !== item.physicalQty);

  const handleApplyAdjustments = async () => {
    // TODO: Create stock movements for all differences
    setCompleted(true);
  };

  if (completed) {
    return (
      <Card>
        <div className="text-center py-6">
          <div className="text-lg font-semibold text-success mb-2">Stock Count Complete</div>
          <div className="text-sm text-text-muted mb-4">
            {differences.length} adjustment{differences.length !== 1 ? "s" : ""} recorded
          </div>
          <Button onClick={() => setCompleted(false)}>Start New Count</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card className="bg-zinc-50">
        <div className="text-sm text-text-muted">
          <div className="font-medium text-text mb-2">Stock Count Instructions:</div>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Physically count each variant in your shop</li>
            <li>Enter the physical quantity below</li>
            <li>Review the differences</li>
            <li>Confirm and apply adjustments</li>
          </ol>
        </div>
      </Card>

      {/* Count Items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Product</th>
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Variant</th>
              <th className="pb-2 text-center text-xs font-medium text-text-muted">System Qty</th>
              <th className="pb-2 text-center text-xs font-medium text-text-muted">Physical Qty</th>
              <th className="pb-2 text-center text-xs font-medium text-text-muted">Difference</th>
            </tr>
          </thead>
          <tbody>
            {countItems.map((item) => {
              const diff = item.physicalQty - item.systemQty;
              const hasDiff = diff !== 0;

              return (
                <tr key={item.variantId} className={`border-b border-border last:border-0 ${hasDiff ? "bg-yellow-50" : ""}`}>
                  <td className="py-2 text-text">{item.productName}</td>
                  <td className="py-2 text-text">{item.variant}</td>
                  <td className="py-2 text-center font-medium text-text">{item.systemQty}</td>
                  <td className="py-2 text-center">
                    <input
                      type="number"
                      min="0"
                      value={item.physicalQty || ""}
                      onChange={(e) =>
                        handlePhysicalQtyChange(item.variantId, parseInt(e.target.value) || 0)
                      }
                      placeholder="—"
                      className="w-16 rounded-md border border-border px-2 py-1 text-center text-sm"
                    />
                  </td>
                  <td className={`py-2 text-center font-medium ${hasDiff ? (diff > 0 ? "text-success" : "text-danger") : "text-text-muted"}`}>
                    {diff === 0 ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {differences.length > 0 && (
        <Card className="border-warning bg-yellow-50">
          <div className="text-sm">
            <div className="font-semibold text-text mb-2">
              {differences.length} Difference{differences.length !== 1 ? "s" : ""} Found
            </div>
            <div className="space-y-1 text-text-muted text-xs">
              {differences.map((item) => {
                const diff = item.physicalQty - item.systemQty;
                return (
                  <div key={item.variantId}>
                    {item.productName} {item.variant}: {diff > 0 ? "+" : ""}{diff}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1">
          Cancel Count
        </Button>
        <Button
          onClick={handleApplyAdjustments}
          disabled={countItems.every((item) => item.physicalQty === 0)}
          className="flex-1"
        >
          Apply Adjustments
        </Button>
      </div>
    </div>
  );
}

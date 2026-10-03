"use client";

import { useEffect, useState } from "react";
import { getStockMovements } from "@/app/(dashboard)/inventory/actions";
import { formatDate } from "@/lib/date-utils";

type StockMovements = Awaited<ReturnType<typeof getStockMovements>>;

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_STOCK: "Opening Stock",
  PURCHASE: "Purchase",
  SALE: "Sale",
  CUSTOMER_RETURN: "Customer Return",
  SUPPLIER_RETURN: "Supplier Return",
  DAMAGE: "Damage",
  LOSS: "Loss",
  ADJUSTMENT: "Manual Adjustment",
  MANUAL_ADJUSTMENT: "Manual Adjustment",
};

function getMovementColor(type: string) {
  if (["PURCHASE", "CUSTOMER_RETURN"].includes(type)) return "text-success";
  if (["SALE", "DAMAGE", "LOSS", "SUPPLIER_RETURN"].includes(type)) return "text-danger";
  return "text-text";
}

export function StockMovementsTab() {
  const [movements, setMovements] = useState<StockMovements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockMovements()
      .then(setMovements)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-sm text-text-muted py-6">Loading movements...</div>;
  }

  if (!movements || movements.length === 0) {
    return <div className="text-center text-sm text-text-muted py-6">No stock movements yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 text-left text-xs font-medium text-text-muted">Date</th>
            <th className="pb-2 text-left text-xs font-medium text-text-muted">Product</th>
            <th className="pb-2 text-left text-xs font-medium text-text-muted">Variant</th>
            <th className="pb-2 text-left text-xs font-medium text-text-muted">Type</th>
            <th className="pb-2 text-right text-xs font-medium text-text-muted">Qty</th>
            <th className="pb-2 text-left text-xs font-medium text-text-muted">User</th>
            <th className="pb-2 text-left text-xs font-medium text-text-muted">Notes</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="py-2 text-text-muted text-xs">
                {formatDate(m.createdAt)}
              </td>
              <td className="py-2 text-text">{m.productVariant.product.name}</td>
              <td className="py-2 text-text">
                {[m.productVariant.size, m.productVariant.color].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="py-2">
                <span className="text-xs font-medium">{MOVEMENT_LABELS[m.type] || m.type}</span>
              </td>
              <td className={`py-2 text-right font-semibold ${getMovementColor(m.type)}`}>
                {m.quantityChange > 0 ? "+" : ""}{m.quantityChange}
              </td>
              <td className="py-2 text-text-muted text-xs">{m.createdBy.name}</td>
              <td className="py-2 text-text-muted text-xs">{m.reason || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

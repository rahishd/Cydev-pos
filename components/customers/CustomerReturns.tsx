"use client";

import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";

export function CustomerReturns({ returns }: { returns: any[] }) {
  if (returns.length === 0) {
    return (
      <Card className="p-4 text-center text-text-muted">
        No returns or exchanges
      </Card>
    );
  }

  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-text-muted font-medium">Invoice</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Date</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Product</th>
            <th className="text-center py-2 px-2 text-text-muted font-medium">Qty</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Type</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Reason</th>
            <th className="text-right py-2 px-2 text-text-muted font-medium">Amount</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Refund Type</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((ret) => {
            const productName = ret.sale.items.length > 0
              ? ret.sale.items[0].productVariant.product.name
              : "-";

            return (
              <tr key={ret.id} className="border-b border-border hover:bg-zinc-50">
                <td className="py-2 px-2 font-medium text-accent">
                  {ret.sale.invoiceNo}
                </td>
                <td className="py-2 px-2 text-text-muted">
                  {new Date(ret.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 px-2 text-text">{productName}</td>
                <td className="py-2 px-2 text-center text-text">{ret.quantity}</td>
                <td className="py-2 px-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    ret.type === "RETURN"
                      ? "bg-danger/20 text-danger"
                      : "bg-warning/20 text-warning"
                  }`}>
                    {ret.type === "RETURN" ? "Return" : "Exchange"}
                  </span>
                </td>
                <td className="py-2 px-2 text-text-muted text-xs">
                  {ret.reason || "-"}
                </td>
                <td className="py-2 px-2 text-right font-medium">
                  NPR {formatCurrency(Number(ret.refundAmount))}
                </td>
                <td className="py-2 px-2">
                  <span className="text-xs px-2 py-1 bg-zinc-100 rounded text-text-muted">
                    {ret.storeCredit ? "Store Credit" : "Refund"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

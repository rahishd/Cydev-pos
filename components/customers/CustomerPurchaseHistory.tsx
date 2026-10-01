"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/date-utils";
import Link from "next/link";

export function CustomerPurchaseHistory({ sales }: { sales: any[] }) {
  if (sales.length === 0) {
    return (
      <Card className="p-4 text-center text-text-muted">
        No purchase history
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
            <th className="text-center py-2 px-2 text-text-muted font-medium">Items</th>
            <th className="text-right py-2 px-2 text-text-muted font-medium">Total</th>
            <th className="text-right py-2 px-2 text-text-muted font-medium">Paid</th>
            <th className="text-right py-2 px-2 text-text-muted font-medium">Balance</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Payment</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const balance = Number(sale.total) - Number(sale.amountPaid);
            const itemCount = sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

            return (
              <tr key={sale.id} className="border-b border-border hover:bg-zinc-50">
                <td className="py-2 px-2 font-medium text-accent">{sale.invoiceNo}</td>
                <td className="py-2 px-2 text-text-muted">
                  {new Date(sale.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 px-2 text-center text-text">{itemCount}</td>
                <td className="py-2 px-2 text-right font-medium">
                  NPR {formatCurrency(Number(sale.total))}
                </td>
                <td className="py-2 px-2 text-right text-text">
                  NPR {formatCurrency(Number(sale.amountPaid))}
                </td>
                <td className={`py-2 px-2 text-right font-medium ${
                  balance > 0 ? "text-danger" : "text-success"
                }`}>
                  NPR {formatCurrency(balance)}
                </td>
                <td className="py-2 px-2 text-xs text-text-muted">
                  {sale.payments.length > 0 ? sale.payments[0].method : "-"}
                </td>
                <td className="py-2 px-2">
                  <Link href={`/sales?search=${sale.invoiceNo}`}>
                    <Button variant="ghost" className="text-xs">
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

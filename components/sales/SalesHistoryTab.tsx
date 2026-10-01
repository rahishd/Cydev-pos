"use client";

import { useState } from "react";
import { getSalesHistory, getSaleDetails } from "@/app/(dashboard)/sales/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/date-utils";

type Sale = {
  id: string;
  invoiceNo: string;
  total: string;
  amountPaid: string;
  createdAt: string;
  customer: { name: string } | null;
  staff: { name: string };
  paymentMethods: string;
  outstanding: number;
  itemCount: number;
};

export function SalesHistoryTab({
  initialSearch,
  initialCustomerId,
  initialPaymentMethod,
  initialSalesHistory,
}: {
  initialSearch: string;
  initialCustomerId: string;
  initialPaymentMethod: string;
  initialSalesHistory: Sale[];
}) {
  const [search, setSearch] = useState(initialSearch);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [sales, setSales] = useState<Sale[]>(initialSalesHistory);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await getSalesHistory(
        search || undefined,
        customerId || undefined,
        paymentMethod || undefined
      );
      setSales(results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (saleId: string) => {
    try {
      const details = await getSaleDetails(saleId);
      setSelectedSale(details);
      setShowDetails(true);
    } catch (err) {
      console.error("Failed to load details:", err);
    }
  };

  const paymentStatusColor = (amountPaid: number, total: number) => {
    if (amountPaid >= total) return "text-success";
    if (amountPaid > 0) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-3">
          <Input
            placeholder="Search invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm"
          />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm"
          >
            <option value="">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="ESEWA">eSewa</option>
            <option value="KHALTI">Khalti</option>
            <option value="FONEPAY">Fonepay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CARD">Card</option>
            <option value="CREDIT">Credit</option>
            <option value="OTHER">Other</option>
          </select>

          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </Card>

      {/* Sales Table */}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Invoice</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Customer</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Date</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Total</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Paid</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Outstanding</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-text-muted">
                  No sales found
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border hover:bg-zinc-50">
                  <td className="py-2 px-2 font-medium text-accent">{sale.invoiceNo}</td>
                  <td className="py-2 px-2 text-text">
                    {sale.customer?.name || "Walk-in"}
                  </td>
                  <td className="py-2 px-2 text-text-muted">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2 font-medium">
                    NPR {formatCurrency(Number(sale.total))}
                  </td>
                  <td className="py-2 px-2">
                    NPR {formatCurrency(Number(sale.amountPaid))}
                  </td>
                  <td className={`py-2 px-2 font-medium ${paymentStatusColor(Number(sale.amountPaid), Number(sale.total))}`}>
                    NPR {formatCurrency(sale.outstanding)}
                  </td>
                  <td className="py-2 px-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleViewDetails(sale.id)}
                      className="text-xs"
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Sale Details Modal */}
      {showDetails && selectedSale && (
        <Modal
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          title={`Invoice #${selectedSale.sale.invoiceNo}`}
          size="lg"
        >
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Date</span>
                <span>{new Date(selectedSale.sale.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Staff</span>
                <span>{selectedSale.sale.staff.name}</span>
              </div>
            </div>

            {/* Customer */}
            {selectedSale.sale.customer && (
              <Card className="p-3">
                <div className="text-sm">
                  <div className="font-semibold text-text mb-1">Customer</div>
                  <div className="text-text">{selectedSale.sale.customer.name}</div>
                  {selectedSale.sale.customer.phone && (
                    <div className="text-text-muted">{selectedSale.sale.customer.phone}</div>
                  )}
                </div>
              </Card>
            )}

            {/* Items */}
            <div>
              <div className="text-xs font-semibold text-text mb-2">Items</div>
              <div className="space-y-2">
                {selectedSale.sale.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs px-2 py-1 bg-zinc-50 rounded">
                    <div>
                      <div className="font-medium text-text">
                        {item.productVariant.product.name}
                      </div>
                      <div className="text-text-muted">
                        {item.productVariant.size && `${item.productVariant.size}`}
                        {item.productVariant.size && item.productVariant.color && " / "}
                        {item.productVariant.color}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {item.quantity} × NPR {formatCurrency(Number(item.unitPrice))}
                      </div>
                      <div className="text-text-muted">
                        NPR {formatCurrency(Number(item.total))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <Card className="p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal</span>
                  <span>NPR {formatCurrency(Number(selectedSale.sale.subtotal))}</span>
                </div>
                {Number(selectedSale.sale.discount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Discount</span>
                    <span>- NPR {formatCurrency(Number(selectedSale.sale.discount))}</span>
                  </div>
                )}
                {Number(selectedSale.sale.tax) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Tax</span>
                    <span>+ NPR {formatCurrency(Number(selectedSale.sale.tax))}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-accent">NPR {formatCurrency(Number(selectedSale.sale.total))}</span>
                </div>
              </div>
            </Card>

            {/* Payment */}
            <Card className="p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Paid</span>
                  <span>NPR {formatCurrency(Number(selectedSale.sale.amountPaid))}</span>
                </div>
                {selectedSale.outstanding > 0 && (
                  <div className="flex justify-between font-bold text-danger">
                    <span>Outstanding</span>
                    <span>NPR {formatCurrency(selectedSale.outstanding)}</span>
                  </div>
                )}
                {selectedSale.profit !== undefined && (
                  <div className="flex justify-between font-bold text-success border-t border-border pt-2">
                    <span>Profit</span>
                    <span>NPR {formatCurrency(selectedSale.profit)}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </Modal>
      )}
    </div>
  );
}

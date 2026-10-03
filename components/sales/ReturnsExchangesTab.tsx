"use client";

import { useState } from "react";
import { getSalesHistory, getSaleDetails, processSaleReturn } from "@/app/(dashboard)/sales/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatCurrency } from "@/lib/date-utils";

type Sale = any;

export function ReturnsExchangesTab() {
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showFindInvoice, setShowFindInvoice] = useState(false);
  const [showProcessReturn, setShowProcessReturn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Return form
  const [returnType, setReturnType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [newVariantId, setNewVariantId] = useState("");
  const [priceDifference, setPriceDifference] = useState(0);

  const handleFindInvoice = async () => {
    if (!search) {
      alert("Please enter an invoice number or customer name");
      return;
    }

    setLoading(true);
    try {
      const results = await getSalesHistory(search);
      setSales(results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = async (saleId: string) => {
    try {
      const details = await getSaleDetails(saleId);
      setSelectedSale(details);
      setShowFindInvoice(false);
      setShowProcessReturn(true);
    } catch (err) {
      console.error("Failed to load sale:", err);
    }
  };

  const handleProcessReturn = async () => {
    if (processing) return;
    if (!selectedItem || quantity <= 0 || !reason) {
      alert("Please select item, quantity, and reason");
      return;
    }

    setProcessing(true);
    try {
      await processSaleReturn(
        selectedSale.sale.id,
        returnType,
        selectedItem.id,
        quantity,
        reason,
        refundMethod,
        returnType === "EXCHANGE" ? newVariantId : undefined,
        returnType === "EXCHANGE" ? priceDifference : undefined
      );

      alert(`${returnType} processed successfully!`);
      setShowProcessReturn(false);
      setSelectedSale(null);
      setSelectedItem(null);
      setQuantity(1);
      setReason("");
      setNewVariantId("");
      setPriceDifference(0);
    } catch (err) {
      console.error("Failed to process return:", err);
      alert(err instanceof Error ? err.message : "Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Find Invoice */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Find Invoice
            </label>
            <Input
              placeholder="Invoice number or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button onClick={handleFindInvoice} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </Card>

      {/* Found Sales */}
      {sales.length > 0 && (
        <Card className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-text-muted font-medium">Invoice</th>
                <th className="text-left py-2 px-2 text-text-muted font-medium">Customer</th>
                <th className="text-left py-2 px-2 text-text-muted font-medium">Date</th>
                <th className="text-left py-2 px-2 text-text-muted font-medium">Total</th>
                <th className="text-left py-2 px-2 text-text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border hover:bg-zinc-50">
                  <td className="py-2 px-2 font-medium text-accent">{sale.invoiceNo}</td>
                  <td className="py-2 px-2 text-text">
                    {sale.customer?.name || "Walk-in"}
                  </td>
                  <td className="py-2 px-2 text-text-muted">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2">
                    NPR {formatCurrency(Number(sale.total))}
                  </td>
                  <td className="py-2 px-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleSelectSale(sale.id)}
                      className="text-xs"
                    >
                      Select
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Process Return Modal */}
      {showProcessReturn && selectedSale && (
        <Modal
          isOpen={showProcessReturn}
          onClose={() => {
            setShowProcessReturn(false);
            setSelectedSale(null);
          }}
          title={`Return / Exchange - ${selectedSale.sale.invoiceNo}`}
          size="lg"
        >
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Sale Info */}
            <Card className="p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Customer</span>
                  <span className="font-medium">
                    {selectedSale.sale.customer?.name || "Walk-in"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Date</span>
                  <span>
                    {new Date(selectedSale.sale.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Return Type */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Return Type
              </label>
              <Select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as "RETURN" | "EXCHANGE")}
              >
                <option value="RETURN">Return</option>
                <option value="EXCHANGE">Exchange</option>
              </Select>
            </div>

            {/* Select Item */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Item to Return *
              </label>
              <Select
                value={selectedItem?.id || ""}
                onChange={(e) => {
                  const item = selectedSale.sale.items.find((i: any) => i.id === e.target.value);
                  setSelectedItem(item);
                  setQuantity(1);
                }}
              >
                <option value="">Select item</option>
                {selectedSale.sale.items.map((item: any) => (
                  <option key={item.id} value={item.id} disabled={item.quantity - item.returnedQty <= 0}>
                    {item.productVariant.product.name}
                    {item.productVariant.size && ` / ${item.productVariant.size}`}
                    {item.productVariant.color && ` / ${item.productVariant.color}`} - Bought: {item.quantity}
                    {item.returnedQty > 0 ? `, already returned: ${item.returnedQty}` : ""}
                    {item.quantity - item.returnedQty <= 0 ? " (fully returned)" : ""}
                  </option>
                ))}
              </Select>
            </div>

            {/* Quantity */}
            {selectedItem && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Quantity to Return * (Max: {selectedItem.quantity - selectedItem.returnedQty})
                </label>
                <Input
                  type="number"
                  min="1"
                  max={selectedItem.quantity - selectedItem.returnedQty}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(selectedItem.quantity - selectedItem.returnedQty, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="text-sm"
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Reason *
              </label>
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select reason</option>
                <option value="SIZE_ISSUE">Size Issue</option>
                <option value="COLOR_MISMATCH">Color Mismatch</option>
                <option value="DAMAGE">Damage</option>
                <option value="QUALITY">Quality Issue</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>

            {/* Refund Method */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Refund Method
              </label>
              <Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                <option value="CASH">Cash Refund</option>
                <option value="STORE_CREDIT">Store Credit</option>
              </Select>
            </div>

            {/* Exchange - New Item */}
            {returnType === "EXCHANGE" && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  New Item *
                </label>
                <Input
                  placeholder="Search variant or enter ID"
                  value={newVariantId}
                  onChange={(e) => setNewVariantId(e.target.value)}
                  className="text-sm mb-2"
                />
                {selectedItem && (
                  <div className="text-xs text-text-muted space-y-1">
                    <div>
                      Original: NPR {formatCurrency(Number(selectedItem.unitPrice))}
                    </div>
                    <div>
                      Price Difference:
                      <Input
                        type="number"
                        value={priceDifference}
                        onChange={(e) => setPriceDifference(Number(e.target.value) || 0)}
                        placeholder="0 for same price, positive for upgrade, negative for downgrade"
                        className="text-sm mt-1"
                      />
                    </div>
                    {priceDifference > 0 && (
                      <div className="text-warning">
                        Customer pays: NPR {formatCurrency(priceDifference)}
                      </div>
                    )}
                    {priceDifference < 0 && (
                      <div className="text-success">
                        Refund: NPR {formatCurrency(Math.abs(priceDifference))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {selectedItem && (
              <Card className="p-3 bg-blue-50">
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-text">
                    {returnType === "RETURN" ? "Return Summary" : "Exchange Summary"}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Item</span>
                    <span>{selectedItem.productVariant.product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Qty</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-1 flex justify-between font-semibold">
                    <span>Amount</span>
                    <span>
                      NPR {formatCurrency(Number(selectedItem.refundPerUnit) * quantity)}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowProcessReturn(false);
                  setSelectedSale(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleProcessReturn} disabled={!selectedItem || processing} className="flex-1">
                {processing ? "Processing..." : `Process ${returnType}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

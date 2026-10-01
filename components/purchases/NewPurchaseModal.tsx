"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/date-utils";
import { useSession } from "next-auth/react";
import { createPurchase } from "@/app/(dashboard)/purchases/actions";
import { prisma } from "@/lib/prisma";

export function NewPurchaseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [supplierRef, setSupplierRef] = useState("");
  const [notes, setNotes] = useState("");

  // Items state
  const [items, setItems] = useState<
    Array<{ variantId: string; quantity: number; purchasePrice: string; discount: number }>
  >([]);
  const [discount, setDiscount] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);

  // Placeholders (will be fetched in real implementation)
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<
    Array<{
      id: string;
      sku: string;
      size?: string;
      color?: string;
      product: { name: string };
    }>
  >([]);

  useEffect(() => {
    if (isOpen) {
      // In real implementation, fetch suppliers and variants
      setSuppliers([
        { id: "1", name: "ABC Shoes" },
        { id: "2", name: "XYZ Bags" },
      ]);
      setVariants([
        { id: "v1", sku: "NK-42", size: "42", color: "Black", product: { name: "Nike Air Max" } },
        { id: "v2", sku: "AD-41", size: "41", color: "White", product: { name: "Adidas Run" } },
      ]);
    }
  }, [isOpen]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + Number(item.purchasePrice) * item.quantity - item.discount, 0);
  const total = subtotal - discount + otherCosts;

  const handleAddItem = () => {
    setItems([...items, { variantId: "", quantity: 0, purchasePrice: "0", discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!supplierId || items.length === 0) {
      setError("Please select a supplier and add at least one item");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createPurchase(
        supplierId,
        new Date(purchaseDate),
        items,
        discount,
        otherCosts,
        paymentMethod,
        supplierRef,
        notes
      );
      onClose();
      setStep(1);
      setSupplierId("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setItems([]);
      setDiscount(0);
      setOtherCosts(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Purchase" size="lg">
      <div className="space-y-6">
        {/* Step 1: Supplier Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">Supplier *</label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">Purchase Date *</label>
                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">Payment Method</label>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">Supplier Invoice Ref</label>
                <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!supplierId || loading}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Add Items */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-text">Purchase Items</h3>
              <Button onClick={handleAddItem} variant="ghost" className="text-xs">
                + Add Item
              </Button>
            </div>

            {/* Items List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <Card key={index} className="p-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Variant</label>
                      <Select
                        value={item.variantId}
                        onChange={(e) => handleUpdateItem(index, "variantId", e.target.value)}
                      >
                        <option value="">Select variant</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.product.name} {v.size && `/ ${v.size}`} {v.color && `/ ${v.color}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Unit Price</label>
                      <Input
                        type="number"
                        value={item.purchasePrice}
                        onChange={(e) => handleUpdateItem(index, "purchasePrice", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Discount</label>
                      <Input
                        type="number"
                        value={item.discount}
                        onChange={(e) => handleUpdateItem(index, "discount", Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-text-muted">
                    <span>
                      Total: NPR{" "}
                      {formatCurrency(
                        Number(item.purchasePrice) * item.quantity - item.discount
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-0.5 h-auto text-danger"
                      onClick={() => handleRemoveItem(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Totals */}
            <Card className="bg-zinc-50 p-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="font-medium">NPR {formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Discount</span>
                  <span>- NPR {formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Other Costs</span>
                  <span>+ NPR {formatCurrency(otherCosts)}</span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>NPR {formatCurrency(total)}</span>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Discount</label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Other Costs</label>
                <Input
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {error && <div className="text-sm text-danger">{error}</div>}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={loading} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={items.length === 0 || loading} className="flex-1">
                {loading ? "Creating..." : "Create Purchase"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

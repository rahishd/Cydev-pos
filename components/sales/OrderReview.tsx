"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/date-utils";
import { useState } from "react";
import { useCan, useSettings } from "@/components/providers/SettingsProvider";

type CartItem = {
  variantId: string;
  variantSku: string;
  productName: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
};

export function OrderReview({
  cart,
  discount,
  tax,
  subtotal,
  total,
  promo,
  onApplyPromo,
  onRemovePromo,
  onUpdateDiscount,
  onUpdateTax,
  onUpdateQuantity,
  onRemoveItem,
  onBack,
  onProceedToPayment,
}: {
  cart: CartItem[];
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  promo: { code: string; discount: number } | null;
  /** Returns an error message, or null when the code was applied. */
  onApplyPromo: (code: string) => Promise<string | null>;
  onRemovePromo: () => void;
  onUpdateDiscount: (value: number) => void;
  onUpdateTax: (value: number) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onRemoveItem: (variantId: string) => void;
  onBack: () => void;
  onProceedToPayment: () => void;
}) {
  const can = useCan();
  const canPromo = can("sales.promo") && Boolean(useSettings().sales.allowDiscounts);
  const [code, setCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [checking, setChecking] = useState(false);

  const applyPromo = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setPromoError("");
    const err = await onApplyPromo(code);
    if (err) setPromoError(err);
    else setCode("");
    setChecking(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] max-h-[90dvh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-text">Order Review</h2>
            <p className="text-sm text-text-muted">Review and confirm your order before payment</p>
          </div>
          <button
            onClick={onBack}
            className="text-text-muted hover:text-text text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-text">Order Items ({cart.length})</h3>
          {cart.map((item, idx) => (
            <div key={item.variantId} className="bg-zinc-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-semibold text-text">{item.productName}</div>
                  <div className="text-sm text-text-muted">
                    {item.size && <span>{item.size}</span>}
                    {item.size && item.color && <span> / </span>}
                    {item.color && <span>{item.color}</span>}
                    {!item.size && !item.color && <span>Standard</span>}
                  </div>
                  <div className="text-xs text-text-muted mt-1">SKU: {item.variantSku}</div>
                </div>
                <button
                  onClick={() => onRemoveItem(item.variantId)}
                  className="text-danger hover:text-red-700 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Quantity and Price Row */}
              <div className="grid grid-cols-2 gap-3 items-end sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-text-muted mb-1">Quantity</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.variantId, Math.max(1, item.quantity - 1))}
                      className="px-2 py-1 bg-zinc-200 text-text rounded hover:bg-zinc-300"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.variantId, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center border border-border rounded px-2 py-1"
                    />
                    <button
                      onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
                      className="px-2 py-1 bg-zinc-200 text-text rounded hover:bg-zinc-300"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1">Unit Price</label>
                  <div className="font-semibold text-accent">NPR {formatCurrency(item.unitPrice)}</div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1">Line Total</label>
                  <div className="font-bold text-lg text-accent">
                    NPR {formatCurrency(item.unitPrice * item.quantity - item.discount)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <Card className="bg-zinc-50 p-4 space-y-3">
          <h3 className="font-semibold text-text">Order Summary</h3>

          <div className="space-y-2">
            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-medium">NPR {formatCurrency(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-text-muted">Discount (NPR)</span>
              <Input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => onUpdateDiscount(Number(e.target.value) || 0)}
                className="w-32 text-right text-sm"
              />
            </div>

            {/* Promo code */}
            {canPromo && (
              <div className="space-y-1">
                {promo ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">
                      Promo <span className="font-mono font-semibold text-success">{promo.code}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-success">- NPR {formatCurrency(promo.discount)}</span>
                      <button type="button" onClick={onRemovePromo} className="text-xs text-danger underline">
                        Remove
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">Promo code</span>
                    <span className="flex items-center gap-2">
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyPromo();
                          }
                        }}
                        placeholder="Enter code"
                        className="w-32 font-mono text-sm"
                      />
                      <Button type="button" variant="secondary" onClick={applyPromo} disabled={checking || !code.trim()}>
                        {checking ? "..." : "Apply"}
                      </Button>
                    </span>
                  </div>
                )}
                {promoError && <p className="text-right text-xs text-danger">{promoError}</p>}
              </div>
            )}

            {/* Tax */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-text-muted">Tax (NPR)</span>
              <Input
                type="number"
                min="0"
                value={tax}
                onChange={(e) => onUpdateTax(Number(e.target.value) || 0)}
                className="w-32 text-right text-sm"
              />
            </div>

            {/* Total */}
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="font-bold text-text">TOTAL</span>
              <span className="text-2xl font-bold text-accent">NPR {formatCurrency(total)}</span>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex gap-3 border-t border-border bg-surface px-6 py-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex-1"
          >
            Back to Products
          </Button>
          <Button
            onClick={onProceedToPayment}
            className="flex-1"
          >
            Proceed to Payment
          </Button>
        </div>
      </Card>
    </div>
  );
}

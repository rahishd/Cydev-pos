"use client";

import { useState, useEffect } from "react";
import { getProductsForPOS, getCustomers, createSale } from "@/app/(dashboard)/sales/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";
import { OrderReview } from "./OrderReview";
import { PaymentModal } from "./PaymentModal";
import { InvoicePreview } from "./InvoicePreview";

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

type Product = {
  id: string;
  name: string;
  category?: { name: string };
  brand?: { name: string };
  variants: any[];
};

export function NewSaleFlow({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [step, setStep] = useState<"search" | "order-review" | "payment" | "invoice">("search");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  const total = subtotal - discount + tax;

  // Modals
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);

  // Search products
  useEffect(() => {
    if (!search.trim()) {
      setProducts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { products: p } = await getProductsForPOS(search);
        setProducts(p);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleAddToCart = () => {
    if (!selectedProduct || !selectedVariant || quantity < 1) return;

    const existing = cart.find((i) => i.variantId === selectedVariant.id);

    if (existing) {
      setCart(
        cart.map((i) =>
          i.variantId === selectedVariant.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      );
    } else {
      setCart([
        ...cart,
        {
          variantId: selectedVariant.id,
          variantSku: selectedVariant.sku,
          productName: selectedProduct.name,
          size: selectedVariant.size,
          color: selectedVariant.color,
          quantity,
          unitPrice: Number(selectedVariant.sellingPrice),
          unitCost: Number(selectedVariant.purchasePrice),
          discount: 0,
        },
      ]);
    }

    // Reset and go back to search
    setSelectedProduct(null);
    setSelectedVariant(null);
    setQuantity(1);
    setSearch("");
    setProducts([]);
  };

  const handleCompletePayment = async (paymentData: any) => {
    try {
      const cartItems = cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        unitCost: item.unitCost.toString(),
        discount: item.discount,
      }));

      const result = await createSale(
        null,
        staffId,
        cartItems,
        subtotal,
        discount,
        tax,
        paymentData.payments || [{ method: paymentData.method, amount: paymentData.amountPaid }],
        paymentData.amountPaid,
        paymentData.dueDate,
        paymentData.deliveryMethod,
        paymentData.deliveryAddress,
        paymentData.deliveryPhone
      );

      setLastInvoice({
        ...paymentData,
        ...result,
        items: cart,
        subtotal,
        discount,
        tax,
        total,
        staffName,
        createdAt: new Date(),
      });

      setShowPayment(false);
      setShowInvoice(true);

      setTimeout(() => {
        setCart([]);
        setDiscount(0);
        setTax(0);
        setStep("search");
        setShowInvoice(false);
      }, 5000);
    } catch (err) {
      console.error("Sale failed:", err);
      alert(err instanceof Error ? err.message : "Failed to create sale");
    }
  };

  // SEARCH STEP
  if (step === "search") {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Search Header */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-text mb-2">New Sale</h2>
            <p className="text-sm text-text-muted">Search for products and add them to your order</p>
          </div>

          <Input
            type="text"
            placeholder="🔍 Search products by name, SKU, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-lg py-3"
            autoFocus
          />

          {cart.length > 0 && (
            <div className="flex items-center justify-between bg-orange-50 p-3 rounded-lg">
              <span className="font-semibold text-text">
                {cart.length} item{cart.length !== 1 ? "s" : ""} in cart • Total: NPR {formatCurrency(total)}
              </span>
              <Button
                onClick={() => {
                  setShowOrderReview(true);
                }}
              >
                Review & Continue
              </Button>
            </div>
          )}
        </Card>

        {/* Search Results */}
        {search.trim() && (
          <div className="mt-6 space-y-3">
            {loading && <div className="text-center text-text-muted py-8">Searching...</div>}

            {!loading && products.length === 0 && (
              <div className="text-center text-text-muted py-8">No products found</div>
            )}

            {!loading &&
              products.map((product) => (
                <Card key={product.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div
                    onClick={() => setSelectedProduct(product)}
                    className="space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-text">{product.name}</h3>
                        <p className="text-sm text-text-muted">
                          {product.brand?.name} • {product.category?.name}
                        </p>
                      </div>
                    </div>

                    {/* Variants */}
                    <div className="space-y-2 border-t pt-3">
                      {product.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="flex justify-between items-center bg-zinc-50 p-2 rounded text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {variant.size || variant.color || "Standard"}
                            </span>
                            <span className="text-text-muted ml-2">
                              (Stock: {variant.quantity})
                            </span>
                          </div>
                          <span className="font-bold text-accent">
                            NPR {formatCurrency(Number(variant.sellingPrice))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-text">{selectedProduct.name}</h3>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-2xl font-bold text-text-muted hover:text-text"
                >
                  ✕
                </button>
              </div>

              {/* Variant Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text">Select Variant *</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedProduct.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      disabled={variant.quantity === 0}
                      className={`w-full p-3 rounded text-left transition-colors ${
                        selectedVariant?.id === variant.id
                          ? "bg-accent text-white"
                          : variant.quantity === 0
                            ? "bg-zinc-100 text-text-muted cursor-not-allowed"
                            : "bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="font-medium">
                        {variant.size && <span>{variant.size}</span>}
                        {variant.size && variant.color && <span> / </span>}
                        {variant.color && <span>{variant.color}</span>}
                        {!variant.size && !variant.color && <span>Standard</span>}
                      </div>
                      <div className="text-sm mt-1">
                        <span>NPR {formatCurrency(Number(variant.sellingPrice))}</span>
                        <span className="ml-3">
                          Stock: {variant.quantity === 0 ? "Out of Stock" : `${variant.quantity} units`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              {selectedVariant && selectedVariant.quantity > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text">Quantity *</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 bg-zinc-100 rounded hover:bg-zinc-200"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedVariant.quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center border border-border rounded px-2 py-2 font-semibold"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(selectedVariant.quantity, quantity + 1))}
                      className="px-3 py-2 bg-zinc-100 rounded hover:bg-zinc-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              {selectedVariant && (
                <Card className="bg-zinc-50 p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-muted">Unit Price:</span>
                    <span className="font-medium">NPR {formatCurrency(Number(selectedVariant.sellingPrice))}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-lg text-accent">
                      NPR {formatCurrency(Number(selectedVariant.sellingPrice) * quantity)}
                    </span>
                  </div>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setSelectedProduct(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || selectedVariant.quantity === 0 || quantity < 1}
                  className="flex-1"
                >
                  Add to Cart
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Continue Button - Always at Bottom */}
        {cart.length > 0 && (
          <div className="fixed bottom-6 left-6 right-6">
            <Button
              onClick={() => setShowOrderReview(true)}
              className="w-full py-4 text-lg"
            >
              Continue to Checkout ({cart.length} items)
            </Button>
          </div>
        )}

        {/* Order Review Modal */}
        {showOrderReview && (
          <OrderReview
            cart={cart}
            discount={discount}
            tax={tax}
            subtotal={subtotal}
            total={total}
            onUpdateDiscount={setDiscount}
            onUpdateTax={setTax}
            onUpdateQuantity={(variantId, newQty) => {
              setCart(
                cart.map((i) =>
                  i.variantId === variantId ? { ...i, quantity: newQty } : i
                )
              );
            }}
            onRemoveItem={(variantId) => {
              setCart(cart.filter((i) => i.variantId !== variantId));
            }}
            onBack={() => {
              setShowOrderReview(false);
            }}
            onProceedToPayment={() => {
              setShowOrderReview(false);
              setShowPayment(true);
            }}
          />
        )}

        {/* Payment Modal */}
        {showPayment && (
          <PaymentModal
            isOpen={showPayment}
            onClose={() => setShowPayment(false)}
            total={total}
            customer={null}
            onComplete={handleCompletePayment}
          />
        )}

        {/* Invoice Preview */}
        {showInvoice && lastInvoice && (
          <InvoicePreview
            isOpen={showInvoice}
            onClose={() => {
              setShowInvoice(false);
              setLastInvoice(null);
            }}
            invoice={lastInvoice}
          />
        )}
      </div>
    );
  }

  return null;
}

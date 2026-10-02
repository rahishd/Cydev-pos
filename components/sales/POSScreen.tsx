"use client";

import { useState, useEffect } from "react";
import { getProductsForPOS, getCustomers, createSale } from "@/app/(dashboard)/sales/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/date-utils";
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

type Customer = {
  id: string;
  name: string;
  phone?: string;
  outstanding: number;
};

type Product = {
  id: string;
  name: string;
  category?: { name: string };
  brand?: { name: string };
  variants: any[];
};

type Category = { id: string; name: string };
type Brand = { id: string; name: string };

export function POSScreen({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [tab, setTab] = useState<"select" | "payment" | "invoice">("select");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      const { products: p, categories: c, brands: b } = await getProductsForPOS(
        search || undefined,
        categoryFilter || undefined,
        brandFilter || undefined
      );
      setProducts(p);
      setCategories(c);
      setBrands(b);
    };

    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, brandFilter]);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      const c = await getCustomers();
      setCustomers(c);
    };
    loadCustomers();
  }, []);

  const addToCart = (variantId: string, quantity: number, variant: any, product: Product) => {
    const existing = cart.find((i) => i.variantId === variantId);

    if (existing) {
      setCart(
        cart.map((i) =>
          i.variantId === variantId ? { ...i, quantity: i.quantity + quantity } : i
        )
      );
    } else {
      setCart([
        ...cart,
        {
          variantId,
          variantSku: variant.sku,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          quantity,
          unitPrice: Number(variant.sellingPrice),
          unitCost: Number(variant.purchasePrice),
          discount: 0,
        },
      ]);
    }
  };

  const updateCartItem = (variantId: string, updates: Partial<CartItem>) => {
    setCart(
      cart.map((i) =>
        i.variantId === variantId ? { ...i, ...updates } : i
      )
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter((i) => i.variantId !== variantId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  const total = subtotal - discount + tax;

  const handleCompletePayment = async (paymentData: any) => {
    try {
      const cartItems = cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        unitCost: item.unitCost.toString(),
        discount: item.discount,
      }));

      // Process all payment parts
      const result = await createSale(
        selectedCustomer?.id || null,
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
        customer: selectedCustomer,
        items: cart,
        subtotal,
        discount,
        tax,
        total,
        staffName,
        createdAt: new Date(),
      });

      setShowPayment(false);
      setTab("invoice");
      setShowInvoice(true);

      // Reset
      setTimeout(() => {
        setCart([]);
        setDiscount(0);
        setTax(0);
        setSelectedCustomer(null);
        setTab("select");
      }, 5000);
    } catch (err) {
      console.error("Sale failed:", err);
      alert(err instanceof Error ? err.message : "Failed to create sale");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
      {/* Left: Products */}
      <div className="col-span-2 flex flex-col gap-4 overflow-y-auto">
        <Card className="p-3 space-y-3">
          <input
            type="text"
            placeholder="🔍 Search product, SKU, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
          />

          <div className="flex gap-2 flex-wrap">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="text-xs"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => {
            const totalStock = product.variants.reduce((sum, v) => sum + v.quantity, 0);
            const inStock = totalStock > 0;

            return (
              <Card key={product.id} className={`p-3 hover:shadow-md transition-all ${inStock ? "cursor-pointer" : ""}`}>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-text">{product.name}</div>
                  <div className="text-xs text-text-muted">{product.brand?.name || "No Brand"}</div>

                  {/* Variant Selection */}
                  <div className="space-y-1">
                    {product.variants.length > 0 && (
                      <div className="text-xs font-semibold text-text-muted mb-1">
                        Select Variant:
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => addToCart(variant.id, 1, variant, product)}
                          disabled={variant.quantity === 0}
                          className={`px-2 py-1.5 rounded text-xs font-medium text-left transition-colors flex justify-between items-center ${
                            variant.quantity === 0
                              ? "bg-zinc-100 text-text-muted cursor-not-allowed"
                              : "bg-orange-50 text-text hover:bg-orange-100"
                          }`}
                        >
                          <span>
                            {variant.size && <span>{variant.size}</span>}
                            {variant.size && variant.color && <span> / </span>}
                            {variant.color && <span>{variant.color}</span>}
                            {!variant.size && !variant.color && <span>Standard</span>}
                          </span>
                          <span className="text-xs font-semibold text-accent">
                            {variant.quantity === 0 ? "0" : variant.quantity}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="text-sm font-bold text-accent">
                      NPR {formatCurrency(Number(product.variants[0]?.sellingPrice || 0))}
                    </div>
                    <div className="text-xs text-text-muted">
                      Stock: {totalStock} units
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {/* Customer */}
        <Card className="p-3 space-y-2">
          <div className="text-xs font-semibold text-text-muted">CUSTOMER</div>
          <div className="flex gap-2">
            <Select
              value={selectedCustomer?.id || ""}
              onChange={(e) => {
                const cust = customers.find((c) => c.id === e.target.value);
                setSelectedCustomer(cust || null);
              }}
              className="flex-1 text-xs"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.outstanding > 0 && `(Unpaid: ${formatCurrency(c.outstanding)})`}
                </option>
              ))}
            </Select>
          </div>
          {selectedCustomer && (
            <div className="text-xs text-text-muted">
              {selectedCustomer.phone && <div>Phone: {selectedCustomer.phone}</div>}
              {selectedCustomer.outstanding > 0 && (
                <div className="text-danger">
                  Outstanding: NPR {formatCurrency(selectedCustomer.outstanding)}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Cart */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <Card className="p-3 text-center text-xs text-text-muted">
              Add products to cart
            </Card>
          ) : (
            cart.map((item) => (
              <Card key={item.variantId} className="p-2 space-y-1">
                <div className="text-xs font-medium text-text">{item.productName}</div>
                <div className="text-xs text-text-muted">
                  {item.size && `${item.size}`}
                  {item.size && item.color && " / "}
                  {item.color}
                </div>

                <div className="flex gap-1 items-center">
                  <button
                    onClick={() =>
                      updateCartItem(item.variantId, { quantity: Math.max(1, item.quantity - 1) })
                    }
                    className="px-1.5 py-0.5 bg-zinc-100 text-text text-xs rounded"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateCartItem(item.variantId, { quantity: parseInt(e.target.value) || 1 })
                    }
                    className="w-8 text-center text-xs border border-border rounded px-1"
                  />
                  <button
                    onClick={() => updateCartItem(item.variantId, { quantity: item.quantity + 1 })}
                    className="px-1.5 py-0.5 bg-zinc-100 text-text text-xs rounded"
                  >
                    +
                  </button>
                  <span className="text-xs font-medium ml-auto">
                    NPR {formatCurrency(item.unitPrice * item.quantity - item.discount)}
                  </span>
                </div>

                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="w-full text-xs py-1 text-danger hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              </Card>
            ))
          )}
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <Card className="p-3 space-y-2 border-t-2 border-border">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-medium">NPR {formatCurrency(subtotal)}</span>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">Discount (NPR)</label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">Tax (NPR)</label>
              <Input
                type="number"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value) || 0)}
                className="text-xs"
              />
            </div>

            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-semibold text-text">TOTAL</span>
              <span className="font-bold text-lg text-accent">
                NPR {formatCurrency(total)}
              </span>
            </div>

            <Button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full"
            >
              Proceed to Payment
            </Button>
          </Card>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          total={total}
          customer={selectedCustomer}
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

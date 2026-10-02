"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";
import { searchCustomersByNameOrPhone } from "@/app/(dashboard)/sales/actions";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  outstanding: number;
};

type PaymentPart = {
  method: string;
  amount: number;
};

export function PaymentModal({
  isOpen,
  onClose,
  total,
  customer,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  customer: Customer | null;
  onComplete: (data: any) => void;
}) {
  const [deliveryMethod, setDeliveryMethod] = useState<"IN_SHOP" | "COD">("IN_SHOP");
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");
  const [payments, setPayments] = useState<PaymentPart[]>([
    { method: "CASH", amount: total },
  ]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.address || "");
  const [deliveryPhone, setDeliveryPhone] = useState(customer?.phone || "");

  // Customer lookup
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;

  // Auto-search customers
  useEffect(() => {
    const query = customerName || customerPhone;
    if (!query.trim()) {
      setCustomerSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchCustomersByNameOrPhone(query);
        setCustomerSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerName, customerPhone]);

  const handleSelectCustomer = (cust: any) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || "");
    setDeliveryAddress(cust.address || "");
    setShowSuggestions(false);
  };

  const handleAddPayment = () => {
    setPayments([...payments, { method: "CASH", amount: Math.max(0, balance) }]);
  };

  const handleUpdatePayment = (idx: number, updates: Partial<PaymentPart>) => {
    const updated = [...payments];
    updated[idx] = { ...updated[idx], ...updates };
    setPayments(updated);
  };

  const handleRemovePayment = (idx: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== idx));
    }
  };

  const handleComplete = () => {
    if (totalPaid <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (deliveryMethod === "COD") {
      if (!deliveryAddress) {
        alert("Delivery address is required for COD");
        return;
      }
      if (!deliveryPhone) {
        alert("Delivery phone is required for COD");
        return;
      }
    }

    onComplete({
      payments,
      amountPaid: Math.min(totalPaid, total),
      deliveryMethod,
      deliveryAddress: deliveryMethod === "COD" ? deliveryAddress : undefined,
      deliveryPhone: deliveryMethod === "COD" ? deliveryPhone : undefined,
      dueDate: payments.some((p) => p.method === "CREDIT")
        ? new Date(dueDate)
        : undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment & Delivery" size="md">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <Card className="bg-zinc-50 p-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Total Amount</span>
              <span className="font-bold text-accent">NPR {formatCurrency(total)}</span>
            </div>
            {customer && (
              <div className="flex justify-between">
                <span className="text-text-muted">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Customer Lookup */}
        <div className="space-y-3 border-b border-border pb-3">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Customer Name</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter customer name or phone number"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => customerSuggestions.length > 0 && setShowSuggestions(true)}
              />
              {showSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-border rounded mt-1 z-10 shadow-lg max-h-40 overflow-y-auto">
                  {customerSuggestions.map((cust) => (
                    <button
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b last:border-0 text-sm"
                    >
                      <div className="font-medium text-text">{cust.name}</div>
                      <div className="text-xs text-text-muted">{cust.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">Contact Number</label>
            <Input
              type="tel"
              placeholder="Enter phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Delivery Method */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Delivery Method *</label>
          <Select
            value={deliveryMethod}
            onChange={(e) => setDeliveryMethod(e.target.value as "IN_SHOP" | "COD")}
          >
            <option value="IN_SHOP">In-Shop Purchase</option>
            <option value="COD">Cash on Delivery (COD)</option>
          </Select>
        </div>

        {/* COD Details */}
        {deliveryMethod === "COD" && (
          <>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Delivery Address *</label>
              <Input
                type="text"
                placeholder="Enter delivery address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Delivery Phone *</label>
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Payment Mode */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Payment Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMode("single")}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                paymentMode === "single"
                  ? "bg-accent text-white"
                  : "bg-zinc-100 text-text hover:bg-zinc-200"
              }`}
            >
              Full Payment
            </button>
            <button
              onClick={() => setPaymentMode("split")}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                paymentMode === "split"
                  ? "bg-accent text-white"
                  : "bg-zinc-100 text-text hover:bg-zinc-200"
              }`}
            >
              Split Payment
            </button>
          </div>
        </div>

        {/* Payment Details */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text mb-2">Payment Details</label>
          {payments.map((payment, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <Select
                value={payment.method}
                onChange={(e) => handleUpdatePayment(idx, { method: e.target.value })}
                className="flex-1"
              >
                <option value="CASH">Cash</option>
                <option value="ESEWA">eSewa</option>
                <option value="KHALTI">Khalti</option>
                <option value="FONEPAY">Fonepay</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
                {customer && <option value="CREDIT">Credit</option>}
                <option value="OTHER">Other</option>
              </Select>
              <Input
                type="number"
                min="0"
                max={total}
                step="100"
                value={payment.amount}
                onChange={(e) => handleUpdatePayment(idx, { amount: Number(e.target.value) || 0 })}
                className="flex-1"
              />
              {payments.length > 1 && (
                <button
                  onClick={() => handleRemovePayment(idx)}
                  className="px-3 py-2 bg-red-50 text-danger rounded text-sm hover:bg-red-100"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {paymentMode === "split" && balance > 0 && (
            <button
              onClick={handleAddPayment}
              className="w-full px-3 py-2 bg-zinc-100 text-text rounded text-sm hover:bg-zinc-200 font-medium"
            >
              + Add Payment Method
            </button>
          )}
        </div>

        {/* Credit Due Date */}
        {payments.some((p) => p.method === "CREDIT") && (
          <div>
            <label className="block text-sm font-medium text-text mb-2">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}

        {/* Payment Summary */}
        <Card className={`${balance >= 0 ? "bg-green-50 border-success/20" : "bg-red-50 border-danger/20"} p-3`}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Total Paid</span>
              <span className="font-medium">NPR {formatCurrency(totalPaid)}</span>
            </div>
            {balance !== 0 && (
              <div className="flex justify-between">
                <span className="text-text-muted">
                  {balance > 0 ? "Balance Due" : "Overpaid"}
                </span>
                <span className={`font-medium ${balance > 0 ? "text-danger" : "text-success"}`}>
                  NPR {formatCurrency(Math.abs(balance))}
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleComplete} className="flex-1" disabled={balance > 0}>
            Complete Sale
          </Button>
        </div>
      </div>
    </Modal>
  );
}

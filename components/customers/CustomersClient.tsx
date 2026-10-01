"use client";

import { useState } from "react";
import { createCustomer } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatCurrency } from "@/lib/date-utils";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  outstanding: number;
  lastPurchase?: Date;
};

export function CustomersClient({
  data,
}: {
  data: {
    customers: Customer[];
    kpi: {
      totalCustomers: number;
      activeCustomers: number;
      customersWithCredit: number;
      totalReceivables: number;
    };
  };
}) {
  const [customers, setCustomers] = useState(data.customers);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add customer form
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const handleAddCustomer = async () => {
    if (!formData.name || !formData.phone) {
      alert("Please enter name and phone");
      return;
    }

    setLoading(true);
    try {
      const result = await createCustomer(
        formData.name,
        formData.phone,
        formData.email || undefined,
        formData.address || undefined,
        formData.notes || undefined
      );

      // Add to list
      setCustomers([
        {
          ...result,
          totalOrders: 0,
          totalSpent: 0,
          outstanding: 0,
          lastPurchase: undefined,
        } as Customer,
        ...customers,
      ]);

      // Reset form
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });

      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add customer:", err);
      alert(err instanceof Error ? err.message : "Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL CUSTOMERS</div>
          <div className="text-2xl font-bold text-text">{data.kpi.totalCustomers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">ACTIVE CUSTOMERS</div>
          <div className="text-2xl font-bold text-text">{data.kpi.activeCustomers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">WITH CREDIT</div>
          <div className="text-2xl font-bold text-danger">{data.kpi.customersWithCredit}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL RECEIVABLES</div>
          <div className="text-2xl font-bold text-accent">
            NPR {formatCurrency(data.kpi.totalReceivables)}
          </div>
        </Card>
      </div>

      {/* Search & Add */}
      <Card className="p-4">
        <div className="flex gap-3">
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => setShowAddModal(true)}>+ Add Customer</Button>
        </div>
      </Card>

      {/* Customers Table */}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-muted font-medium">Customer</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Phone</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Email</th>
              <th className="text-center py-2 px-2 text-text-muted font-medium">Orders</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Total Spent</th>
              <th className="text-right py-2 px-2 text-text-muted font-medium">Outstanding</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Last Purchase</th>
              <th className="text-left py-2 px-2 text-text-muted font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-text-muted">
                  No customers found
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className="border-b border-border hover:bg-zinc-50">
                  <td className="py-2 px-2 font-medium text-text">{customer.name}</td>
                  <td className="py-2 px-2 text-text-muted">{customer.phone || "-"}</td>
                  <td className="py-2 px-2 text-text-muted text-xs">{customer.email || "-"}</td>
                  <td className="py-2 px-2 text-center text-text">{customer.totalOrders}</td>
                  <td className="py-2 px-2 text-right text-text font-medium">
                    NPR {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className={`py-2 px-2 text-right font-medium ${
                    customer.outstanding > 0 ? "text-danger" : "text-text"
                  }`}>
                    NPR {formatCurrency(customer.outstanding)}
                  </td>
                  <td className="py-2 px-2 text-text-muted text-xs">
                    {customer.lastPurchase
                      ? new Date(customer.lastPurchase).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="py-2 px-2">
                    <Link href={`/customers/${customer.id}`}>
                      <Button variant="ghost" className="text-xs">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add Customer Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Customer"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Name *</label>
              <Input
                placeholder="Customer name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">Phone *</label>
              <Input
                placeholder="Phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">Email</label>
              <Input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">Address</label>
              <Input
                placeholder="Customer address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">Notes</label>
              <Textarea
                placeholder="Optional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowAddModal(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAddCustomer} disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

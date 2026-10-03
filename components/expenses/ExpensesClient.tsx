"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Drawer } from "@/components/ui/Drawer";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileInput } from "@/components/ui/FileInput";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  createExpenseCategory,
  ExpensesPageData,
} from "@/app/(dashboard)/expenses/actions";
import { ExpenseShareModal, type ShareTarget } from "./ExpenseShareModal";

const PAYMENT_METHODS = [
  "CASH",
  "ESEWA",
  "KHALTI",
  "FONEPAY",
  "BANK_TRANSFER",
  "CARD",
  "OTHER",
];

const EXPENSE_STATUSES = ["PAID", "UNPAID"];

interface FormState {
  categoryId: string;
  amount: string;
  date: string;
  paymentMethod: string;
  status: string;
  description: string;
  attachmentUrl: string;
  attachmentName: string;
}

function StatTile({
  label,
  value,
  format = "currency",
}: {
  label: string;
  value: number;
  format?: "currency" | "text";
}) {
  const formatted =
    format === "currency" ? `NPR ${value.toLocaleString()}` : value.toString();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{formatted}</p>
    </div>
  );
}

export default function ExpensesClient({
  initialData,
}: {
  initialData: ExpensesPageData;
}) {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Categories
  const [categories, setCategories] = useState(initialData.categories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  // Form state
  const [form, setForm] = useState<FormState>({
    categoryId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "CASH",
    status: "PAID",
    description: "",
    attachmentUrl: "",
    attachmentName: "",
  });

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return initialData.expenses.filter((expense) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        expense.id.toLowerCase().includes(searchLower) ||
        expense.description?.toLowerCase().includes(searchLower);

      const matchesCategory =
        !selectedCategory || expense.categoryId === selectedCategory;
      const matchesMethod =
        !selectedPaymentMethod ||
        expense.paymentMethod === selectedPaymentMethod;
      const matchesStatus =
        !selectedStatus || expense.status === selectedStatus;

      const expenseDate = new Date(expense.date);
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      const matchesDateFrom = !fromDate || expenseDate >= fromDate;
      const matchesDateTo =
        !toDate || expenseDate <= new Date(toDate.getTime() + 86400000);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesMethod &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    search,
    selectedCategory,
    selectedPaymentMethod,
    selectedStatus,
    dateFrom,
    dateTo,
  ]);

  const handleReportClick = () => {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const catName = categories.find((c) => c.id === selectedCategory)?.name;
    const filterParts = [
      catName && `Category: ${catName}`,
      selectedPaymentMethod && `Method: ${getPaymentMethodLabel(selectedPaymentMethod)}`,
      selectedStatus && `Status: ${selectedStatus}`,
      search && `Search: "${search}"`,
    ].filter(Boolean) as string[];
    setShareTarget({
      kind: "report",
      data: {
        expenses: filteredExpenses,
        periodLabel:
          dateFrom || dateTo
            ? `${dateFrom ? fmt(dateFrom) : "Start"} - ${dateTo ? fmt(dateTo) : "Today"}`
            : "All dates",
        filterLabel: filterParts.join("  |  ") || undefined,
      },
      filters: {
        from: dateFrom,
        to: dateTo,
        category: selectedCategory,
        method: selectedPaymentMethod,
        status: selectedStatus,
        q: search,
      },
    });
  };

  const handleAddClick = () => {
    setEditingId(null);
    setForm({
      categoryId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "CASH",
      status: "PAID",
      description: "",
      attachmentUrl: "",
      attachmentName: "",
    });
    setIsDrawerOpen(true);
  };

  const handleEditClick = (expense: (typeof initialData.expenses)[0]) => {
    setEditingId(expense.id);
    setForm({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split("T")[0],
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      description: expense.description || "",
      attachmentUrl: expense.attachmentUrl || "",
      attachmentName: expense.attachmentUrl ? "attached" : "",
    });
    setIsDrawerOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm("Delete this expense?")) {
      try {
        await deleteExpense(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    }
  };

  const handleSaveExpense = async () => {
    if (!form.categoryId || !form.amount) {
      setError("Category and amount are required");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateExpense({
          id: editingId,
          categoryId: form.categoryId,
          amount: parseFloat(form.amount),
          date: new Date(form.date),
          paymentMethod: form.paymentMethod,
          status: form.status,
          description: form.description || undefined,
          attachmentUrl: form.attachmentUrl || undefined,
        });
      } else {
        await createExpense({
          categoryId: form.categoryId,
          amount: parseFloat(form.amount),
          date: new Date(form.date),
          paymentMethod: form.paymentMethod,
          status: form.status,
          description: form.description || undefined,
          attachmentUrl: form.attachmentUrl || undefined,
        });
      }
      router.refresh();
      setIsDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const newCategory = await createExpenseCategory(newCategoryName);
      setCategories([...categories, newCategory]);
      setNewCategoryName("");
      setShowCategoryInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || id;
  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      CASH: "Cash",
      ESEWA: "eSewa",
      KHALTI: "Khalti",
      FONEPAY: "Fonepay",
      BANK_TRANSFER: "Bank Transfer",
      CARD: "Card",
      OTHER: "Other",
    };
    return labels[method] || method;
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedPaymentMethod("");
    setSelectedStatus("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    search ||
    selectedCategory ||
    selectedPaymentMethod ||
    selectedStatus ||
    dateFrom ||
    dateTo;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total Expenses — This Month"
          value={initialData.stats.totalThisMonth}
        />
        <StatTile
          label="Total Expenses — Today"
          value={initialData.stats.totalToday}
        />
        {initialData.stats.largestCategory && (
          <StatTile
            label={`Largest Category (${initialData.stats.largestCategory.name})`}
            value={initialData.stats.largestCategory.total}
          />
        )}
        <StatTile
          label="Unpaid Expenses"
          value={initialData.stats.unpaidTotal}
        />
      </div>

      {/* Search & Filters */}
      <Card>
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Search
              </label>
              <Input
                placeholder="Search by ID or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="w-full lg:w-48">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Category
              </label>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full lg:w-48">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Payment Method
              </label>
              <Select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              >
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {getPaymentMethodLabel(method)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full lg:w-48">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Status
              </label>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                {EXPENSE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>

            <Button
              variant="ghost"
              onClick={handleReportClick}
              className="px-4 py-2 rounded-lg font-medium text-sm"
            >
              Report (PDF)
            </Button>

            <Button
              onClick={handleAddClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              + Add Expense
            </Button>
          </div>

          {/* Date Range */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <Button
                  onClick={clearFilters}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Date
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                ID
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Category
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Description
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-900">
                Amount
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Method
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Status
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Added By
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-500">
                  {initialData.expenses.length === 0
                    ? "No expenses recorded yet"
                    : "No expenses match filters"}
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-gray-700">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-600">
                    {expense.id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {expense.categoryName}
                  </td>
                  <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                    {expense.description || "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    NPR {expense.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {getPaymentMethodLabel(expense.paymentMethod)}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        expense.status === "PAID" ? "success" : "warning"
                      }
                    >
                      {expense.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {expense.createdByName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShareTarget({ kind: "voucher", expense })}
                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => handleEditClick(expense)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(expense.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                      {expense.attachmentUrl && (
                        <a
                          href={expense.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          Receipt
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <ExpenseShareModal
        key={shareTarget ? (shareTarget.kind === "voucher" ? shareTarget.expense.id : "report") : "none"}
        target={shareTarget}
        onClose={() => setShareTarget(null)}
      />

      {/* Add/Edit Drawer */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingId ? "Edit Expense" : "Add Expense"}
      >
        <div className="space-y-4 p-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Category *
            </label>
            {showCategoryInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm"
                >
                  Add
                </Button>
                <Button
                  onClick={() => setShowCategoryInput(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <button
                  onClick={() => setShowCategoryInput(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                >
                  + Create new category
                </button>
              </>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Amount (NPR) *
            </label>
            <Input
              type="number"
              placeholder="5000"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Date *
            </label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Payment Method *
            </label>
            <Select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {getPaymentMethodLabel(method)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Status *
            </label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {EXPENSE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Description
            </label>
            <textarea
              placeholder="Monthly electricity bill..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Receipt (JPG, PNG, PDF)
            </label>
            <FileInput
              onFileSelect={(url, name) =>
                setForm({ ...form, attachmentUrl: url, attachmentName: name })
              }
              onError={(error) => setError(error)}
              currentUrl={form.attachmentUrl}
              currentName={form.attachmentName}
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button
              onClick={handleSaveExpense}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              {isSaving ? "Saving..." : "Save Expense"}
            </Button>
            <Button
              onClick={() => setIsDrawerOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

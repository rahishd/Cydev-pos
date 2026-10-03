"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { PaymentMethodChart } from "@/components/dashboard/PaymentMethodChart";
import { getDashboardDataByDateRange } from "./dashboard-actions";
import { useEffect } from "react";

type DateRange = "today" | "yesterday" | "thisWeek" | "custom";

interface DashboardData {
  kpi: any;
  chartData: any;
  salesByPaymentMethod: any;
  topProducts: any;
  lowStockItems: any;
  recentSales: any;
  customerCreditList: any;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </Card>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="py-6 text-center text-sm text-text-muted"
      >
        No data yet
      </td>
    </tr>
  );
}

function DateFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "bg-zinc-100 text-text hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

export default function DashboardClient({
  canSeeProfit,
  defaultRange,
}: {
  canSeeProfit: boolean;
  defaultRange: DateRange;
}) {
  const [selectedRange, setSelectedRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let params: any = { dateRange: selectedRange };
        if (selectedRange === "custom" && customStart && customEnd) {
          params.customStart = customStart;
          params.customEnd = customEnd;
        }
        const dashboardData = await getDashboardDataByDateRange(params);
        setData(dashboardData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedRange, customStart, customEnd]);

  if (loading || !data) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  const { kpi, chartData, salesByPaymentMethod, topProducts, lowStockItems, recentSales, customerCreditList } = data;
  const rangeLabel = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This week",
    custom: customStart && customEnd ? `${customStart} to ${customEnd}` : "Custom range",
  }[selectedRange];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Dashboard</h1>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text">Filter by:</span>
        <DateFilterButton
          label="Today"
          active={selectedRange === "today"}
          onClick={() => setSelectedRange("today")}
        />
        <DateFilterButton
          label="Yesterday"
          active={selectedRange === "yesterday"}
          onClick={() => setSelectedRange("yesterday")}
        />
        <DateFilterButton
          label="This Week"
          active={selectedRange === "thisWeek"}
          onClick={() => setSelectedRange("thisWeek")}
        />
        <DateFilterButton
          label="Custom"
          active={selectedRange === "custom"}
          onClick={() => setSelectedRange("custom")}
        />

        {selectedRange === "custom" && (
          <div className="flex gap-2 ml-4">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 text-sm border border-border rounded"
            />
            <span className="text-text-muted">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 text-sm border border-border rounded"
            />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Sales"
          value={`Rs ${formatCurrency(kpi.todaySales)}`}
          sub={`${kpi.todayTransactions} transaction${kpi.todayTransactions !== 1 ? "s" : ""}`}
        />
        <KpiCard
          label="Transactions"
          value={String(kpi.todayTransactions)}
          sub={rangeLabel}
        />
        {canSeeProfit && (
          <KpiCard
            label="Gross Profit"
            value={`Rs ${formatCurrency(kpi.todayProfit)}`}
            sub={rangeLabel}
          />
        )}
        <KpiCard
          label="Monthly Sales"
          value={`Rs ${formatCurrency(kpi.monthlySales)}`}
          sub="This month"
        />
        {canSeeProfit && (
          <KpiCard
            label="Monthly Profit"
            value={`Rs ${formatCurrency(kpi.monthlyProfit)}`}
            sub="This month"
          />
        )}
        <KpiCard
          label="Inventory Value"
          value={`Rs ${formatCurrency(kpi.inventoryValue)}`}
          sub="At cost"
        />
        <KpiCard
          label="Receivables"
          value={`Rs ${formatCurrency(kpi.receivables)}`}
          sub="Outstanding"
        />
      </div>

      {/* Sales Overview + Payment Method */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Sales Overview — Last 7 Days" />
          <SalesChart data={chartData} />
        </Card>
        <Card>
          <SectionHeader title="Sales by Payment Method" />
          <PaymentMethodChart data={salesByPaymentMethod} />
        </Card>
      </div>

      {/* Inventory Status + Low Stock */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Low Stock */}
        <Card>
          <SectionHeader title="Low Stock Products" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Product</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Variant</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Stock</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Min</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length === 0 ? (
                <EmptyRow cols={4} />
              ) : (
                lowStockItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-text">{item.product.name}</td>
                    <td className="py-2 text-text-muted">
                      {[item.size, item.color].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={
                          item.quantity === 0
                            ? "font-semibold text-danger"
                            : "font-semibold text-warning"
                        }
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td className="py-2 text-right text-text-muted">{item.minStockLevel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <SectionHeader title="Top Selling Products" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Product</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Qty Sold</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <EmptyRow cols={3} />
              ) : (
                topProducts.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <div className="font-medium text-text">{item.name}</div>
                      <div className="text-xs text-text-muted">{item.variant}</div>
                    </td>
                    <td className="py-2 text-right text-text">{item.qtySold}</td>
                    <td className="py-2 text-right text-text">
                      Rs {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <SectionHeader title="Recent Transactions" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Invoice</th>
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Customer</th>
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Staff</th>
              <th className="pb-2 text-left text-xs font-medium text-text-muted">Method</th>
              <th className="pb-2 text-right text-xs font-medium text-text-muted">Amount</th>
              <th className="pb-2 text-right text-xs font-medium text-text-muted">Date</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.length === 0 ? (
              <EmptyRow cols={6} />
            ) : (
              recentSales.map((sale) => (
                <tr key={sale.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs text-text">{sale.invoiceNo}</td>
                  <td className="py-2 text-text">{sale.customer?.name ?? "Guest"}</td>
                  <td className="py-2 text-text-muted">{sale.staff.name}</td>
                  <td className="py-2 text-text-muted">
                    {sale.payments[0]?.method ?? "—"}
                  </td>
                  <td className="py-2 text-right text-text">
                    Rs {formatCurrency(Number(sale.total))}
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    {formatDate(sale.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Customer Receivables */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <SectionHeader title="Customer Receivables" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Customer</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Outstanding</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {customerCreditList.length === 0 ? (
                <EmptyRow cols={3} />
              ) : (
                customerCreditList.map((c) => {
                  const outstanding = Number(c.amount) - Number(c.amountPaid);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        <div className="font-medium text-text">{c.customer.name}</div>
                        {c.customer.phone && (
                          <div className="text-xs text-text-muted">{c.customer.phone}</div>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium text-text">
                        Rs {formatCurrency(outstanding)}
                      </td>
                      <td className="py-2 text-right text-text-muted">
                        {c.dueDate ? formatDate(c.dueDate) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>

      </div>
    </div>
  );
}

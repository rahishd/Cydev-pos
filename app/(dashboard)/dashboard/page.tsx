import { getDashboardData } from "@/lib/dashboard-data";
import { formatCurrency, formatDate } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { PaymentMethodChart } from "@/components/dashboard/PaymentMethodChart";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { kpi, chartData, salesByPaymentMethod, topProducts, lowStockItems, recentSales, customerCreditList, supplierPayableList } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Today's Sales"
          value={`Rs ${formatCurrency(kpi.todaySales)}`}
          sub={`${kpi.todayTransactions} transaction${kpi.todayTransactions !== 1 ? "s" : ""}`}
        />
        <KpiCard
          label="Transactions"
          value={String(kpi.todayTransactions)}
          sub="Today"
        />
        <KpiCard
          label="Gross Profit"
          value={`Rs ${formatCurrency(kpi.todayProfit)}`}
          sub="Today"
        />
        <KpiCard
          label="Monthly Sales"
          value={`Rs ${formatCurrency(kpi.monthlySales)}`}
          sub="This month"
        />
        <KpiCard
          label="Monthly Profit"
          value={`Rs ${formatCurrency(kpi.monthlyProfit)}`}
          sub="This month"
        />
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
        <KpiCard
          label="Payables"
          value={`Rs ${formatCurrency(kpi.payables)}`}
          sub="To suppliers"
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

      {/* Customer Receivables + Supplier Payables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <Card>
          <SectionHeader title="Supplier Payables" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Supplier</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">PO #</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {supplierPayableList.length === 0 ? (
                <EmptyRow cols={3} />
              ) : (
                supplierPayableList.map((p) => {
                  const outstanding = Number(p.total) - Number(p.paidAmount);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium text-text">{p.supplier.name}</td>
                      <td className="py-2 font-mono text-xs text-text-muted">{p.purchaseNo}</td>
                      <td className="py-2 text-right font-medium text-text">
                        Rs {formatCurrency(outstanding)}
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

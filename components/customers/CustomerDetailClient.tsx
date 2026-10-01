"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/date-utils";
import { CustomerOverview } from "./CustomerOverview";
import { CustomerPurchaseHistory } from "./CustomerPurchaseHistory";
import { CustomerCredit } from "./CustomerCredit";
import { CustomerReturns } from "./CustomerReturns";

export function CustomerDetailClient({
  data,
  customerId,
}: {
  data: any;
  customerId: string;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "purchases", label: "Purchase History" },
    { id: "credit", label: "Credit" },
    { id: "returns", label: "Returns" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL ORDERS</div>
          <div className="text-2xl font-bold text-text">{data.summary.totalOrders}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">TOTAL SPENT</div>
          <div className="text-2xl font-bold text-text">
            NPR {formatCurrency(data.summary.totalSpent)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">RETURNS</div>
          <div className="text-2xl font-bold text-text">{data.summary.totalReturns}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-1">OUTSTANDING</div>
          <div className={`text-2xl font-bold ${data.summary.outstanding > 0 ? "text-danger" : "text-success"}`}>
            NPR {formatCurrency(data.summary.outstanding)}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="border-b border-border">
        <div className="flex gap-4 px-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && <CustomerOverview customer={data.customer} />}
        {activeTab === "purchases" && <CustomerPurchaseHistory sales={data.customer.sales} />}
        {activeTab === "credit" && (
          <CustomerCredit credits={data.customer.credits} customerId={customerId} />
        )}
        {activeTab === "returns" && <CustomerReturns returns={data.returns} />}
      </div>
    </div>
  );
}

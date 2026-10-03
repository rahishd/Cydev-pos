"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { NewSaleFlow } from "./NewSaleFlow";
import { SalesHistoryTab } from "./SalesHistoryTab";
import { ReturnsExchangesTab } from "./ReturnsExchangesTab";
import { Button } from "@/components/ui/Button";

export function SalesClient({
  allowedTabs,
  initialTab,
  initialSearch,
  initialCustomerId,
  initialPaymentMethod,
  initialSalesHistory,
}: {
  allowedTabs: string[];
  initialTab: string;
  initialSearch: string;
  initialCustomerId: string;
  initialPaymentMethod: string;
  initialSalesHistory: any[];
}) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = ([
    { id: "pos", label: "New Sale", icon: "💳" },
    { id: "history", label: "Sales History", icon: "📋" },
    { id: "returns", label: "Returns & Exchanges", icon: "↩️" },
  ]).filter((t) => allowedTabs.includes(t.id));

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "pos" && session && (
          <NewSaleFlow staffId={session.user.id} staffName={session.user.name} />
        )}
        {activeTab === "history" && (
          <SalesHistoryTab
            initialSearch={initialSearch}
            initialCustomerId={initialCustomerId}
            initialPaymentMethod={initialPaymentMethod}
            initialSalesHistory={initialSalesHistory}
          />
        )}
        {activeTab === "returns" && <ReturnsExchangesTab />}
      </div>
    </div>
  );
}

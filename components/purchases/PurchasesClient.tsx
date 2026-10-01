"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/date-utils";
import { NewPurchaseModal } from "./NewPurchaseModal";
import { ReceiveGoodsModal } from "./ReceiveGoodsModal";
import { RecordPaymentModal } from "./RecordPaymentModal";
import type { Prisma } from "@prisma/client";

type PurchasesData = Awaited<ReturnType<typeof import("@/app/(dashboard)/purchases/actions").getPurchasesPageData>>;

function KpiCard({ label, value, subLabel }: { label: string; value: string | number; subLabel?: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {subLabel && <span className="text-xs text-text-muted">{subLabel}</span>}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "bg-zinc-100", text: "text-text-muted", label: "Draft" },
    ORDERED: { bg: "bg-blue-100", text: "text-blue-700", label: "Ordered" },
    PARTIALLY_RECEIVED: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Partial" },
    RECEIVED: { bg: "bg-green-100", text: "text-success", label: "Received" },
    CANCELLED: { bg: "bg-red-100", text: "text-danger", label: "Cancelled" },
  };

  const config = statusConfig[status] || statusConfig.DRAFT;

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-md ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export function PurchasesClient({ data }: { data: PurchasesData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [receiveGoodsOpen, setReceiveGoodsOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>();

  const handleSearch = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      router.push(`?${params.toString()}`);
    });
  };

  const handleFilter = (filterName: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value && value !== "all") {
        params.set(filterName, value);
      } else {
        params.delete(filterName);
      }
      router.push(`?${params.toString()}`);
    });
  };

  const handleAction = (purchaseId: string, action: string) => {
    setSelectedPurchaseId(purchaseId);
    if (action === "receive") {
      setReceiveGoodsOpen(true);
    } else if (action === "payment") {
      setRecordPaymentOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Purchases</h1>
        <Button onClick={() => setNewPurchaseOpen(true)}>+ New Purchase</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Purchases"
          value={`NPR ${formatCurrency(data.kpi.totalPurchases)}`}
        />
        <KpiCard
          label="Pending Orders"
          value={data.kpi.pendingOrders}
          subLabel="unordered"
        />
        <KpiCard
          label="Received"
          value={data.kpi.receivedCount}
          subLabel="purchases"
        />
        <KpiCard
          label="Outstanding"
          value={`NPR ${formatCurrency(data.kpi.outstandingPayables)}`}
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="space-y-3">
          <Input
            placeholder="🔍 Search purchase number..."
            defaultValue={data.filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isPending}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select
              value={data.filters.supplierId || ""}
              onChange={(e) => handleFilter("supplier", e.target.value)}
              disabled={isPending}
            >
              <option value="">All suppliers</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              value={data.filters.status || ""}
              onChange={(e) => handleFilter("status", e.target.value)}
              disabled={isPending}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ORDERED">Ordered</option>
              <option value="PARTIALLY_RECEIVED">Partial</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Select
              value={data.filters.paymentStatus || ""}
              onChange={(e) => handleFilter("paymentStatus", e.target.value)}
              disabled={isPending}
            >
              <option value="">All payment</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Purchase List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Purchase #</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Supplier</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Date</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Total</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Paid</th>
                <th className="pb-2 text-right text-xs font-medium text-text-muted">Outstanding</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Status</th>
                <th className="pb-2 text-left text-xs font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-text-muted">
                    No purchases found
                  </td>
                </tr>
              ) : (
                data.purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs font-semibold text-text">
                      {purchase.purchaseNo}
                    </td>
                    <td className="py-2 text-text">{purchase.supplier.name}</td>
                    <td className="py-2 text-text-muted text-xs">
                      {new Date(purchase.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2 text-right font-medium text-text">
                      NPR {formatCurrency(Number(purchase.total))}
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      NPR {formatCurrency(Number(purchase.paidAmount))}
                    </td>
                    <td className="py-2 text-right font-medium text-text">
                      NPR {formatCurrency(purchase.outstanding)}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={purchase.status} />
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-0.5 h-auto"
                          onClick={() => {
                            // TODO: Navigate to purchase details
                          }}
                        >
                          View
                        </Button>
                        {purchase.status === "ORDERED" ||
                        purchase.status === "PARTIALLY_RECEIVED" ? (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-0.5 h-auto"
                            onClick={() => handleAction(purchase.id, "receive")}
                          >
                            Receive
                          </Button>
                        ) : null}
                        {purchase.outstanding > 0 ? (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-0.5 h-auto"
                            onClick={() => handleAction(purchase.id, "payment")}
                          >
                            Pay
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <NewPurchaseModal isOpen={newPurchaseOpen} onClose={() => setNewPurchaseOpen(false)} />

      {selectedPurchaseId && (
        <>
          <ReceiveGoodsModal
            isOpen={receiveGoodsOpen}
            onClose={() => setReceiveGoodsOpen(false)}
            purchaseId={selectedPurchaseId}
            onSuccess={() => {
              setReceiveGoodsOpen(false);
              router.refresh();
            }}
          />

          <RecordPaymentModal
            isOpen={recordPaymentOpen}
            onClose={() => setRecordPaymentOpen(false)}
            purchaseId={selectedPurchaseId}
            onSuccess={() => {
              setRecordPaymentOpen(false);
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

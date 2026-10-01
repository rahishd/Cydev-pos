"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/date-utils";
import { InventoryDetailModal } from "./InventoryDetailModal";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { StockMovementsTab } from "./StockMovementsTab";
import { StockCountTab } from "./StockCountTab";
import type { Prisma } from "@prisma/client";

type InventoryData = Awaited<ReturnType<typeof import("@/app/(dashboard)/inventory/actions").getInventoryPageData>>;

function KpiCard({ label, value, subLabel }: { label: string; value: string | number; subLabel?: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {subLabel && <span className="text-xs text-text-muted">{subLabel}</span>}
    </Card>
  );
}

function StockBadge({ quantity, minStock }: { quantity: number; minStock: number }) {
  if (quantity === 0) {
    return <span className="text-xs font-medium text-danger">Out</span>;
  }
  if (quantity <= minStock) {
    return <span className="text-xs font-medium text-warning">Low</span>;
  }
  return <span className="text-xs font-medium text-success">In Stock</span>;
}

export function InventoryClient({ data }: { data: InventoryData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  const [currentTab, setCurrentTab] = useState<"overview" | "movements" | "count">("overview");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const selectedVariant = data.variants.find((v) => v.id === selectedVariantId);

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

  const handleViewDetails = (variantId: string) => {
    setSelectedVariantId(variantId);
    setDetailModalOpen(true);
  };

  const handleAdjustStock = () => {
    setDetailModalOpen(false);
    setAdjustmentModalOpen(true);
  };

  const handleAdjustmentSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    // In a real app, we would refresh the data
  };

  const tabs = [
    { id: "overview", label: "Stock Overview" },
    { id: "movements", label: "Stock Movements" },
    { id: "count", label: "Stock Count" },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text">Inventory</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Stock"
          value={`${data.kpi.totalStock.toLocaleString()} units`}
        />
        <KpiCard
          label="Low Stock"
          value={data.kpi.lowStockCount}
          subLabel="variants"
        />
        <KpiCard
          label="Out of Stock"
          value={data.kpi.outOfStockCount}
          subLabel="variants"
        />
        <KpiCard
          label="Inventory Value"
          value={`NPR ${formatCurrency(data.kpi.inventoryValue)}`}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                currentTab === tab.id
                  ? "border-b-2 border-accent text-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Overview Tab */}
      {currentTab === "overview" && (
        <>
          {/* Filters */}
          <Card>
            <div className="space-y-3">
              <Input
                placeholder="🔍 Search product, SKU, size, color..."
                defaultValue={data.filters.search || ""}
                onChange={(e) => handleSearch(e.target.value)}
                disabled={isPending}
              />
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={data.filters.categoryId || ""}
                  onChange={(e) => handleFilter("category", e.target.value)}
                  disabled={isPending}
                >
                  <option value="">All categories</option>
                  {data.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={data.filters.brandId || ""}
                  onChange={(e) => handleFilter("brand", e.target.value)}
                  disabled={isPending}
                >
                  <option value="">All brands</option>
                  {data.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={data.filters.stockStatus || "all"}
                  onChange={(e) => handleFilter("stock", e.target.value)}
                  disabled={isPending}
                >
                  <option value="all">All stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Stock Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-medium text-text-muted">Product</th>
                    <th className="pb-2 text-left text-xs font-medium text-text-muted">Variant</th>
                    <th className="pb-2 text-left text-xs font-medium text-text-muted">SKU</th>
                    <th className="pb-2 text-right text-xs font-medium text-text-muted">Stock</th>
                    <th className="pb-2 text-right text-xs font-medium text-text-muted">Min</th>
                    <th className="pb-2 text-left text-xs font-medium text-text-muted">Status</th>
                    <th className="pb-2 text-left text-xs font-medium text-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-text-muted">
                        No variants found
                      </td>
                    </tr>
                  ) : (
                    data.variants.map((variant) => (
                      <tr key={variant.id} className="border-b border-border last:border-0">
                        <td className="py-2">
                          <div className="font-medium text-text">{variant.product.name}</div>
                          <div className="text-xs text-text-muted">
                            {variant.product.category?.name}
                          </div>
                        </td>
                        <td className="py-2 text-text">
                          {[variant.size, variant.color].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="py-2 font-mono text-xs text-text-muted">{variant.sku}</td>
                        <td className="py-2 text-right text-text">
                          <span
                            className={
                              variant.quantity === 0
                                ? "font-semibold text-danger"
                                : variant.quantity <= variant.minStockLevel
                                  ? "font-semibold text-warning"
                                  : "font-semibold"
                            }
                          >
                            {variant.quantity}
                          </span>
                        </td>
                        <td className="py-2 text-right text-text-muted">{variant.minStockLevel}</td>
                        <td className="py-2">
                          <StockBadge quantity={variant.quantity} minStock={variant.minStockLevel} />
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              className="text-xs px-2 py-0.5 h-auto"
                              onClick={() => handleViewDetails(variant.id)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-xs px-2 py-0.5 h-auto"
                              onClick={() => {
                                setSelectedVariantId(variant.id);
                                setAdjustmentModalOpen(true);
                              }}
                            >
                              Adjust
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Results count */}
          <div className="text-sm text-text-muted">
            Showing {data.variants.length} variant{data.variants.length !== 1 ? "s" : ""}
          </div>
        </>
      )}

      {/* Stock Movements Tab */}
      {currentTab === "movements" && (
        <Card>
          <StockMovementsTab key={refreshTrigger} />
        </Card>
      )}

      {/* Stock Count Tab */}
      {currentTab === "count" && (
        <StockCountTab variants={data.variants} />
      )}

      {/* Modals */}
      <InventoryDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        variantId={selectedVariantId}
        onAdjustClick={handleAdjustStock}
      />

      <StockAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        variantId={selectedVariantId}
        variantName={selectedVariant ? `${selectedVariant.product.name} - ${[selectedVariant.size, selectedVariant.color].filter(Boolean).join(" / ")}` : ""}
        currentStock={selectedVariant?.quantity}
        onSuccess={handleAdjustmentSuccess}
        userId={session?.user?.id}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ReportView } from "@/components/reports/ReportView";
import { runReport } from "@/app/(dashboard)/reports/actions";
import { PAYMENT_METHODS, REPORT_GROUPS, REPORTS, type ReportDef } from "@/lib/reports/catalog";
import { PRESETS, presetRange, type Preset } from "@/lib/reports/range";
import type { FilterKey, Filters, ReportResult } from "@/lib/reports/types";

type Option = { id: string; name: string };
export type ReportOptions = { categories: Option[]; brands: Option[]; staff: Option[]; customers: Option[]; suppliers: Option[] };

const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Category",
  brand: "Brand",
  staff: "Staff",
  customer: "Customer",
  supplier: "Supplier",
  method: "Payment method",
};

type Extras = Pick<Filters, "categoryId" | "brandId" | "staffId" | "customerId" | "supplierId" | "method">;
const NO_EXTRAS: Extras = {};

export function ReportsClient({
  allowed,
  options,
  today,
  canExport,
  canPrint,
  userName,
  shopName,
}: {
  allowed: string[];
  options: ReportOptions;
  today: string;
  canExport: boolean;
  canPrint: boolean;
  userName: string;
  shopName: string;
}) {
  const open = REPORTS.filter((r) => allowed.includes(r.key));
  const [key, setKey] = useState(open[0]?.key ?? "overview");
  const def = open.find((r) => r.key === key) as ReportDef | undefined;

  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [draft, setDraft] = useState(() => ({ ...presetRange("thisMonth", today), ...NO_EXTRAS }));
  const [applied, setApplied] = useState(draft);

  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    if (!def) return;
    const mine = ++seq.current;
    setLoading(true);
    setError("");
    runReport(key, applied)
      .then((r) => {
        if (mine === seq.current) setResult(r);
      })
      .catch((e) => {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "Could not build this report.");
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [key, applied, def]);

  const pickReport = (k: string) => {
    setKey(k);
    // Filters that don't apply to the new report would silently narrow it, so clear them.
    const next = open.find((r) => r.key === k);
    const keep: Extras = {};
    const map: Record<FilterKey, keyof Extras> = { category: "categoryId", brand: "brandId", staff: "staffId", customer: "customerId", supplier: "supplierId", method: "method" };
    for (const f of next?.filters ?? []) if (draft[map[f]]) keep[map[f]] = draft[map[f]];
    const merged = { from: draft.from, to: draft.to, ...keep };
    setDraft(merged);
    setApplied(merged);
  };

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const r = presetRange(p, today);
    const next = { ...draft, ...r };
    setDraft(next);
    setApplied(next);
  };

  const reset = () => {
    setPreset("thisMonth");
    const next = { ...presetRange("thisMonth", today), ...NO_EXTRAS };
    setDraft(next);
    setApplied(next);
  };

  const setExtra = (k: keyof Extras, v: string) => setDraft((d) => ({ ...d, [k]: v || undefined }));

  const extraSelect = (f: FilterKey) => {
    const map: Record<FilterKey, [keyof Extras, Array<{ id: string; name: string }>]> = {
      category: ["categoryId", options.categories],
      brand: ["brandId", options.brands],
      staff: ["staffId", options.staff],
      customer: ["customerId", options.customers],
      supplier: ["supplierId", options.suppliers],
      method: ["method", PAYMENT_METHODS.map((m) => ({ id: m.value, name: m.label }))],
    };
    const [field, list] = map[f];
    return (
      <div key={f} className="min-w-36">
        <label className="mb-1 block text-xs text-text-muted">{FILTER_LABELS[f]}</label>
        <Select value={draft[field] ?? ""} onChange={(e) => setExtra(field, e.target.value)}>
          <option value="">All</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
    );
  };

  const exportAs = async (kind: "pdf" | "csv") => {
    if (!result) return;
    const lib = await import("@/lib/reports/export");
    if (kind === "pdf") lib.exportPdf(result, { by: userName });
    else lib.exportCsv(result, { by: userName });
  };

  const print = () => {
    // Print on white paper whatever theme is on screen.
    const html = document.documentElement;
    const was = html.dataset.theme;
    html.dataset.theme = "light";
    const restore = () => {
      if (was) html.dataset.theme = was;
      else delete html.dataset.theme;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  if (open.length === 0) {
    return <p className="text-sm text-text-muted">Your account doesn&apos;t have access to any reports yet. Ask the Owner.</p>;
  }

  return (
    <div className="gap-6 lg:flex">
      <nav className="no-print mb-4 hidden w-52 shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto pr-1">
          {REPORT_GROUPS.map((g) => {
            const items = open.filter((r) => r.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                {g !== "Overview" && <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g}</div>}
                {items.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => pickReport(r.key)}
                    className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${r.key === key ? "bg-accent/15 font-semibold text-accent" : "text-text hover:bg-zinc-100"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="no-print lg:hidden">
          <label className="mb-1 block text-xs text-text-muted">Report</label>
          <Select value={key} onChange={(e) => pickReport(e.target.value)}>
            {REPORT_GROUPS.map((g) => {
              const items = open.filter((r) => r.group === g);
              if (items.length === 0) return null;
              return (
                <optgroup key={g} label={g}>
                  {items.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </div>

        <Card className="no-print p-4">
          <div className="flex flex-wrap items-end gap-3">
            {!def?.asOf && (
              <>
                <div className="min-w-36">
                  <label className="mb-1 block text-xs text-text-muted">Period</label>
                  <Select value={preset} onChange={(e) => choosePreset(e.target.value as Preset)}>
                    {PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">From</label>
                  <input
                    type="date"
                    value={draft.from}
                    max={draft.to}
                    onChange={(e) => {
                      setPreset("custom");
                      setDraft((d) => ({ ...d, from: e.target.value }));
                    }}
                    className="glass-input text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">To</label>
                  <input
                    type="date"
                    value={draft.to}
                    min={draft.from}
                    onChange={(e) => {
                      setPreset("custom");
                      setDraft((d) => ({ ...d, to: e.target.value }));
                    }}
                    className="glass-input text-sm"
                  />
                </div>
              </>
            )}
            {(def?.filters ?? []).map(extraSelect)}
            <div className="flex gap-2">
              <Button onClick={() => setApplied(draft)} disabled={loading}>
                Apply
              </Button>
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text">{result?.title ?? def?.label}</h2>
            <p className="text-xs text-text-muted">{result?.periodLabel ?? ""}</p>
          </div>
          {result && (canExport || canPrint) && (
            <div className="flex gap-2">
              {canExport && (
                <>
                  <Button variant="secondary" onClick={() => exportAs("pdf")}>
                    Export PDF
                  </Button>
                  <Button variant="secondary" onClick={() => exportAs("csv")}>
                    Export CSV
                  </Button>
                </>
              )}
              {canPrint && (
                <Button variant="secondary" onClick={print}>
                  Print
                </Button>
              )}
            </div>
          )}
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
        ) : loading && !result ? (
          <p className="py-10 text-center text-sm text-text-muted">Building the report...</p>
        ) : result ? (
          <div className={`print-area transition-opacity ${loading ? "opacity-50" : ""}`}>
            <div className="mb-4 hidden print:block">
              <div className="text-lg font-bold">{shopName}</div>
              <div className="text-sm">
                {result.title} · {result.periodLabel}
              </div>
              <div className="text-xs">
                Generated {new Date().toLocaleString("en-US")} by {userName}
              </div>
            </div>
            <ReportView result={result} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { deletePromo, savePromo, setPromoActive, type PromoInput, type PromoRow } from "@/app/(dashboard)/promocodes/actions";
import type { PromoState } from "@/lib/promo";

type Data = {
  rows: PromoRow[];
  canManage: boolean;
  stats: { total: number; active: number; redemptions: number; discountGiven: number };
};

const money = (n: number) => `NPR ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const fmtDay = (d: string) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

const STATE: Record<PromoState, { label: string; variant: "success" | "warning" | "danger" | "default" | "info" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Switched off", variant: "default" },
  scheduled: { label: "Starts later", variant: "info" },
  expired: { label: "Expired", variant: "danger" },
  used_up: { label: "Used up", variant: "warning" },
};

const blank = (): PromoInput => ({
  code: "",
  description: "",
  type: "PERCENT",
  value: 10,
  minPurchase: 0,
  maxDiscount: null,
  startDay: "",
  endDay: "",
  usageLimit: null,
  isActive: true,
});

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold text-text">{value}</div>
    </Card>
  );
}

function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

export function PromoCodesClient({ data, today }: { data: Data; today: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<PromoInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (!status || r.state === status) &&
          (!search.trim() || `${r.code} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [data.rows, search, status]
  );

  const set = <K extends keyof PromoInput>(k: K, v: PromoInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const edit = (r: PromoRow) => {
    setError("");
    setForm({
      id: r.id,
      code: r.code,
      description: r.description,
      type: r.type,
      value: r.value,
      minPurchase: r.minPurchase,
      maxDiscount: r.maxDiscount,
      startDay: r.startDay,
      endDay: r.endDay,
      usageLimit: r.usageLimit,
      isActive: r.isActive,
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      await savePromo(form);
      setForm(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the promo code");
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">Promo Codes</h1>
          <p className="text-sm text-text-muted">Discount codes staff can enter at checkout. Each use is counted and recorded on the sale.</p>
        </div>
        {data.canManage && (
          <Button
            onClick={() => {
              setError("");
              setForm({ ...blank(), startDay: today });
            }}
          >
            + New Promo Code
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Promo Codes" value={String(data.stats.total)} />
        <StatTile label="Active Now" value={String(data.stats.active)} />
        <StatTile label="Times Used" value={String(data.stats.redemptions)} />
        <StatTile label="Discount Given" value={money(data.stats.discountGiven)} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-48 flex-1">
            <Input placeholder="Search code or description..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-44">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Offer</th>
              <th className="px-4 py-2.5 font-medium">Minimum</th>
              <th className="px-4 py-2.5 font-medium">Valid</th>
              <th className="px-4 py-2.5 text-right font-medium">Used</th>
              <th className="px-4 py-2.5 text-right font-medium">Discount Given</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              {data.canManage && <th className="px-4 py-2.5 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                  {data.rows.length === 0 ? "No promo codes yet. Create your first one." : "No promo codes match."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-text">{r.code}</div>
                    {r.description && <div className="text-xs text-text-muted">{r.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-text">{r.offer}</td>
                  <td className="px-4 py-3 text-text-muted">{r.minPurchase > 0 ? money(r.minPurchase) : "None"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                    {r.startDay || r.endDay ? `${r.startDay ? fmtDay(r.startDay) : "Any time"} to ${r.endDay ? fmtDay(r.endDay) : "no end"}` : "Always"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {r.usedCount}
                    {r.usageLimit !== null ? ` / ${r.usageLimit}` : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(r.discountGiven)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATE[r.state].variant}>{STATE[r.state].label}</Badge>
                  </td>
                  {data.canManage && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => edit(r)} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-zinc-100">
                          Edit
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, () => setPromoActive(r.id, !r.isActive))}
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                        >
                          {r.isActive ? "Switch off" : "Switch on"}
                        </button>
                        {r.usedCount === 0 && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => confirm(`Delete promo code ${r.code}?`) && act(r.id, () => deletePromo(r.id))}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-danger hover:bg-zinc-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit Promo Code" : "New Promo Code"}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving} className="flex-1">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form?.code.trim()} className="flex-1">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <Label>Code *</Label>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                  maxLength={20}
                  placeholder="e.g. DASHAIN10"
                  className="font-mono"
                />
                <Button type="button" variant="secondary" onClick={() => set("code", randomCode())}>
                  Generate
                </Button>
              </div>
              <p className="mt-1 text-xs text-text-muted">3 to 20 letters, numbers, - or _. Customers aren&apos;t asked to type it; staff enter it at checkout.</p>
            </div>

            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Who is this for? (optional)" maxLength={200} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount type *</Label>
                <Select value={form.type} onChange={(e) => set("type", e.target.value as "PERCENT" | "FIXED")}>
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FIXED">Fixed amount (NPR)</option>
                </Select>
              </div>
              <div>
                <Label>{form.type === "PERCENT" ? "Percent off *" : "Amount off (NPR) *"}</Label>
                <Input type="number" min="0" value={form.value} onChange={(e) => set("value", Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Minimum purchase (NPR)</Label>
                <Input type="number" min="0" value={form.minPurchase} onChange={(e) => set("minPurchase", Number(e.target.value))} />
              </div>
              {form.type === "PERCENT" && (
                <div>
                  <Label>Maximum discount (NPR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.maxDiscount ?? ""}
                    placeholder="No cap"
                    onChange={(e) => set("maxDiscount", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts on</Label>
                <input type="date" value={form.startDay} onChange={(e) => set("startDay", e.target.value)} className="glass-input w-full text-sm" />
              </div>
              <div>
                <Label>Ends on</Label>
                <input type="date" value={form.endDay} min={form.startDay || undefined} onChange={(e) => set("endDay", e.target.value)} className="glass-input w-full text-sm" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-text-muted">Leave a date empty for no start or no end. The end date is included.</p>

            <div>
              <Label>Total uses allowed</Label>
              <Input
                type="number"
                min="1"
                value={form.usageLimit ?? ""}
                placeholder="Unlimited"
                onChange={(e) => set("usageLimit", e.target.value ? Number(e.target.value) : null)}
              />
              <p className="mt-1 text-xs text-text-muted">Counts every sale the code is used on, across all customers.</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
              Code is switched on
            </label>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  );
}

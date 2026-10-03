"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { fmtCard, fmtCell, fmtMoney, isNumericFmt } from "@/lib/reports/format";
import type { ChartSpec, ReportResult, ReportTable } from "@/lib/reports/types";

const COLORS = ["#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2", "#ca8a04", "#db2777", "#475569"];

const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function Chart({ spec }: { spec: ChartSpec }) {
  const fmt = (v: unknown) => (spec.money ? fmtMoney(Number(v)) : Number(v).toLocaleString("en-US"));
  const empty = spec.data.length === 0 || spec.data.every((d) => spec.series.every((s) => !Number(d[s.key])));
  return (
    <Card className="p-4">
      <div className="mb-2 text-sm font-semibold text-text">{spec.title}</div>
      {empty ? (
        <p className="py-10 text-center text-sm text-text-muted">No data for this period.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {spec.kind === "donut" ? (
              <PieChart>
                <Pie data={spec.data} dataKey={spec.series[0].key} nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                  {spec.data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            ) : spec.kind === "hbar" ? (
              <BarChart data={spec.data} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(113,113,122,0.25)" />
                <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey={spec.series[0].key} name={spec.series[0].label} fill={COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : spec.kind === "bar" ? (
              <BarChart data={spec.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(113,113,122,0.25)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => fmt(v)} />
                {spec.series.map((s, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={spec.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(113,113,122,0.25)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => fmt(v)} />
                {spec.series.length > 1 && <Legend />}
                {spec.series.map((s, i) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={spec.data.length < 32} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function Table({ t }: { t: ReportTable }) {
  return (
    <Card className="p-0">
      {t.title && <div className="border-b border-border px-4 py-3 text-sm font-semibold text-text">{t.title}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
            {t.cols.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 font-medium ${isNumericFmt(c.fmt) ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.length === 0 ? (
            <tr>
              <td colSpan={t.cols.length} className="px-4 py-8 text-center text-text-muted">
                Nothing to show for this period.
              </td>
            </tr>
          ) : (
            t.rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {t.cols.map((c) => (
                  <td key={c.key} className={`px-4 py-2 ${isNumericFmt(c.fmt) ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                    {fmtCell(row[c.key], c.fmt)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {t.totals && t.rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-border font-semibold">
              {t.cols.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 ${isNumericFmt(c.fmt) ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                  {t.totals![c.key] === undefined ? "" : fmtCell(t.totals![c.key], c.fmt)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}

function CashRecon({ lines }: { lines: Array<{ label: string; value: number }> }) {
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const open = Number(opening) || 0;
  const expected = open + lines.reduce((a, l) => a + l.value, 0);
  const diff = Number(counted) - expected;
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-semibold text-text">Cash reconciliation</div>
      <div className="max-w-md space-y-2 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span className="text-text-muted">Opening cash</span>
          <input type="number" min="0" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" className="glass-input w-40 text-right" />
        </label>
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between">
            <span className="text-text-muted">{l.label}</span>
            <span className="tabular-nums">{fmtMoney(l.value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span>Expected cash</span>
          <span className="tabular-nums">{fmtMoney(expected)}</span>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-text-muted">Cash counted</span>
          <input type="number" min="0" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" className="glass-input w-40 text-right" />
        </label>
        {counted !== "" && (
          <div className={`flex justify-between font-semibold ${Math.abs(diff) < 0.005 ? "text-success" : "text-danger"}`}>
            <span>{Math.abs(diff) < 0.005 ? "Balanced" : diff > 0 ? "Over by" : "Short by"}</span>
            <span className="tabular-nums">{fmtMoney(Math.abs(diff))}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReportView({ result }: { result: ReportResult }) {
  return (
    <div className="space-y-4">
      {result.cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {result.cards.map((c) => (
            <Card key={c.label} className="p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{c.label}</div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${c.tone === "good" ? "text-success" : c.tone === "bad" ? "text-danger" : "text-text"}`}>
                {fmtCard(c.value, c.fmt)}
              </div>
              {c.hint && <div className="mt-0.5 text-[11px] text-text-muted">{c.hint}</div>}
            </Card>
          ))}
        </div>
      )}

      {result.charts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2 no-print">
          {result.charts.map((c) => (
            <Chart key={c.title} spec={c} />
          ))}
        </div>
      )}

      {result.cashRecon && <CashRecon lines={result.cashRecon.lines} />}

      {result.tables.map((t, i) => (
        <Table key={i} t={t} />
      ))}

      {result.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {result.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

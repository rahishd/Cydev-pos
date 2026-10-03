"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import {
  exportAuditLog,
  getAuditEntry,
  getAuditFilterOptions,
  getAuditLog,
  getAuditSummary,
  type AuditDetail,
  type AuditFilters,
  type AuditListRow,
} from "@/app/(dashboard)/audit-log/actions";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { groupOf } from "@/lib/audit-meta";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

const PERMISSION_LABEL = new Map(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

function StatTile({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className={`text-2xl font-semibold ${tone ?? "text-text"}`}>{value === null ? "-" : value.toLocaleString()}</span>
    </Card>
  );
}

function Dot({ status, action }: { status: string; action: string }) {
  const color =
    status === "FAILED"
      ? "bg-red-500"
      : ["created", "updated", "deleted", "adjustment", "price_changed", "permissions_changed", "settings_changed", "deactivated", "cancelled", "password_reset"].includes(action)
        ? "bg-amber-500"
        : "bg-green-500";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "-";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(v);
};

function Changes({ previous, next }: { previous: unknown; next: unknown }) {
  const prev = (previous && typeof previous === "object" ? previous : {}) as Record<string, unknown>;
  const nxt = (next && typeof next === "object" ? next : {}) as Record<string, unknown>;

  // Permission changes get their own readable before/after table.
  if (Array.isArray(prev.permissions) && Array.isArray(nxt.permissions)) {
    const before = new Set(prev.permissions as string[]);
    const after = new Set(nxt.permissions as string[]);
    const changed = [...new Set([...before, ...after])].filter((k) => before.has(k) !== after.has(k));
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5">Permission</th>
            <th className="py-1.5">Before</th>
            <th className="py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {changed.length === 0 ? (
            <tr><td colSpan={3} className="py-3 text-text-muted">No permission was changed.</td></tr>
          ) : (
            changed.map((k) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="py-1.5">{PERMISSION_LABEL.get(k) ?? k}</td>
                <td className="py-1.5">{before.has(k) ? "Enabled" : "Disabled"}</td>
                <td className={`py-1.5 font-medium ${after.has(k) ? "text-success" : "text-danger"}`}>
                  {after.has(k) ? "Enabled" : "Disabled"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  }

  const keys = [...new Set([...Object.keys(prev), ...Object.keys(nxt)])];
  if (keys.length === 0) return null;
  const hasBefore = Object.keys(prev).length > 0;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-text-muted">
          <th className="py-1.5">Field</th>
          {hasBefore && <th className="py-1.5">Before</th>}
          <th className="py-1.5">{hasBefore ? "After" : "Value"}</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const changed = JSON.stringify(prev[k]) !== JSON.stringify(nxt[k]);
          return (
            <tr key={k} className="border-b border-border last:border-0 align-top">
              <td className="py-1.5 pr-3 text-text-muted">{k}</td>
              {hasBefore && <td className="py-1.5 pr-3 text-text-muted">{show(prev[k])}</td>}
              <td className={`py-1.5 ${hasBefore && changed ? "font-medium text-text" : "text-text"}`}>{show(nxt[k])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-sm text-text">{children || "-"}</div>
    </div>
  );
}

export function AuditLogClient() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAuditSummary>> | null>(null);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getAuditFilterOptions>> | null>(null);
  const [data, setData] = useState<{ rows: AuditListRow[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [actionGroup, setActionGroup] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState<AuditFilters["range"]>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters: AuditFilters = { q, userId, module: moduleName, actionGroup, status, range, from, to };

  // Server calls are made one at a time: while one is running, only the newest filter state waits.
  const latest = useRef<AuditFilters>({});
  latest.current = { q, userId, module: moduleName, actionGroup, status, range, from, to, page };
  const running = useRef(false);
  const rerun = useRef(false);
  const load = useCallback(async () => {
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        rerun.current = false;
        setError("");
        try {
          setData(await getAuditLog(latest.current));
          setSummary(await getAuditSummary());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load the audit log");
        }
      } while (rerun.current);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, q, userId, moduleName, actionGroup, status, range, from, to, page]);

  useEffect(() => {
    getAuditFilterOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  const change = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const clearAll = () => {
    setSearch("");
    setQ("");
    setUserId("");
    setModuleName("");
    setActionGroup("");
    setStatus("");
    setRange("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const anyFilter = !!(q || userId || moduleName || actionGroup || status || range);

  const download = async () => {
    setExporting(true);
    try {
      const res = await exportAuditLog(filters);
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">Audit Log</h1>
          <p className="text-sm text-text-muted">
            Who did what, to which record, and when. Entries can&apos;t be edited or deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load}>Refresh</Button>
          <Button variant="secondary" onClick={download} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Today" value={summary?.today ?? null} />
        <StatTile label="Logins" value={summary?.logins ?? null} />
        <StatTile label="Changes" value={summary?.changes ?? null} />
        <StatTile label="Failed" value={summary?.failed ?? null} tone={summary && summary.failed > 0 ? "text-danger" : undefined} />
      </div>

      <Card className="space-y-3">
        <Input
          placeholder="Search audit logs: user, invoice no, product, Audit ID (AUD-000014)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Select value={userId} onChange={(e) => change(() => setUserId(e.target.value))}>
            <option value="">User: All</option>
            {options?.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.userId})</option>
            ))}
          </Select>
          <Select value={moduleName} onChange={(e) => change(() => setModuleName(e.target.value))}>
            <option value="">Module: All</option>
            {options?.modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Select value={actionGroup} onChange={(e) => change(() => setActionGroup(e.target.value))}>
            <option value="">Action: All</option>
            {options?.actionGroups.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => change(() => setStatus(e.target.value))}>
            <option value="">Status: All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </Select>
          <Select value={range} onChange={(e) => change(() => setRange(e.target.value as AuditFilters["range"]))}>
            <option value="">Date: All time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </Select>
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            From
            <input type="date" value={from} onChange={(e) => change(() => setFrom(e.target.value))} className="rounded border border-border px-2 py-1 text-text" />
            to
            <input type="date" value={to} onChange={(e) => change(() => setTo(e.target.value))} className="rounded border border-border px-2 py-1 text-text" />
          </div>
        )}
        {anyFilter && (
          <button onClick={clearAll} className="text-xs font-medium text-accent hover:underline">
            Clear all filters
          </button>
        )}
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
              <th className="w-6 px-3 py-2" />
              <th className="px-3 py-2">Date &amp; Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data === null ? (
              <tr><td colSpan={7} className="py-8 text-center text-text-muted">Loading...</td></tr>
            ) : data.rows.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-text-muted">No activity matches these filters</td></tr>
            ) : (
              data.rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => getAuditEntry(r.id).then(setDetail)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-zinc-50/60"
                >
                  <td className="px-3 py-2"><Dot status={r.status} action={r.action} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-muted">{fmtDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="font-medium text-text">{r.userName}</div>
                    <div className="text-xs text-text-muted">{r.userCode}{r.userRole ? ` · ${r.userRole.toLowerCase()}` : ""}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{r.title}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-muted">{r.module}</td>
                  <td className="max-w-md px-3 py-2 text-text-muted">
                    <div className="line-clamp-2">{r.description}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold ${r.status === "FAILED" ? "text-danger" : "text-success"}`}>
                      {r.status === "FAILED" ? "Failed" : "Success"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-muted">
          <span>{data ? `${data.total.toLocaleString()} entr${data.total === 1 ? "y" : "ies"}` : ""}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Audit Detail" size="lg">
        {detail && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Audit ID">{detail.auditId}</Field>
              <Field label="Date & time">{fmtDateTime(detail.createdAt)}</Field>
              <Field label="Status">
                <span className={detail.status === "FAILED" ? "font-semibold text-danger" : "font-semibold text-success"}>
                  {detail.status === "FAILED" ? "Failed" : "Success"}
                </span>
              </Field>
              <Field label="User">{detail.userName}{detail.userCode ? ` (${detail.userCode})` : ""}</Field>
              <Field label="Role">{detail.userRole ? detail.userRole.charAt(0) + detail.userRole.slice(1).toLowerCase() : ""}</Field>
              <Field label="Action">{detail.title}</Field>
              <Field label="Module">{detail.module}</Field>
              <Field label="Record">{detail.entityType}{detail.entityId ? ` · ${detail.entityId}` : ""}</Field>
              <Field label="Type">{groupOf(detail.action)}</Field>
            </div>

            <Field label="Description">{detail.description}</Field>
            {detail.failureReason && <Field label="Failure reason"><span className="text-danger">{detail.failureReason}</span></Field>}
            {detail.reason && <Field label="Reason">{detail.reason}</Field>}

            {!!(detail.previous || detail.next) && (
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">What changed</div>
                <div className="rounded-md border border-border px-3 py-2">
                  <Changes previous={detail.previous} next={detail.next} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <Field label="Device">{detail.device ?? ""}</Field>
              <Field label="IP address">{detail.ipAddress ?? ""}</Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

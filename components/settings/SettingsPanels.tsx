"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  createExpenseCategoryAction,
  getBackupInfo,
  getExpenseCategories,
  renameExpenseCategory,
  saveBusinessLogo,
  setExpenseCategoryActive,
  type ExpenseCategoryRow,
} from "@/app/(dashboard)/settings/actions";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// ---------- Logo ----------

async function fileToLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 360;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
}

export function LogoPanel({ logo }: { logo?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logo ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const pick = async (file?: File) => {
    if (!file) return;
    setMsg("");
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setMsg("Please choose a PNG or JPG image.");
      return;
    }
    try {
      setPreview(await fileToLogoDataUrl(file));
      setDirty(true);
    } catch {
      setMsg("Could not read that image.");
    }
  };

  const save = async (value: string | null) => {
    setBusy(true);
    setMsg("");
    try {
      await saveBusinessLogo(value);
      setPreview(value);
      setDirty(false);
      setMsg(value ? "Logo saved." : "Logo removed. The default logo will be used.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save the logo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 text-sm font-semibold text-text">Shop logo</div>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-zinc-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Shop logo" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-text-muted">Default logo</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => input.current?.click()}>
              Choose image
            </Button>
            {dirty && preview && (
              <Button type="button" onClick={() => save(preview)} disabled={busy}>
                {busy ? "Saving..." : "Save logo"}
              </Button>
            )}
            {(logo || dirty) && (
              <Button variant="ghost" type="button" onClick={() => (dirty ? (setPreview(logo ?? null), setDirty(false)) : save(null))} disabled={busy}>
                {dirty ? "Cancel" : "Remove"}
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">
            PNG or JPG, resized automatically. Shown on invoices, vouchers, the sidebar and the login page.
          </p>
          {msg && <p className="text-xs text-text">{msg}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Expense categories ----------

export function ExpenseCategoriesPanel() {
  const [rows, setRows] = useState<ExpenseCategoryRow[] | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");

  const load = () => getExpenseCategories().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category, e.g. Electricity"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) run(async () => { await createExpenseCategoryAction(name); setName(""); });
          }}
        />
        <Button
          type="button"
          disabled={!name.trim()}
          onClick={() => run(async () => { await createExpenseCategoryAction(name); setName(""); })}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="divide-y divide-border rounded-md border border-border">
        {rows === null ? (
          <p className="p-4 text-sm text-text-muted">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">No categories yet. Add Rent, Salary, Electricity and so on.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              {editing?.id === r.id ? (
                <div className="flex flex-1 gap-2">
                  <Input value={editing.name} onChange={(e) => setEditing({ id: r.id, name: e.target.value })} />
                  <Button type="button" onClick={() => run(async () => { await renameExpenseCategory(r.id, editing.name); setEditing(null); })}>
                    Save
                  </Button>
                  <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={r.isActive ? "font-medium text-text" : "text-text-muted line-through"}>{r.name}</span>
                    {!r.isActive && <Badge variant="default">Inactive</Badge>}
                    <span className="text-xs text-text-muted">{r.used} expense{r.used === 1 ? "" : "s"}</span>
                  </div>
                  <div className="flex gap-3 text-xs font-medium">
                    <button className="text-accent hover:underline" onClick={() => setEditing({ id: r.id, name: r.name })}>
                      Edit
                    </button>
                    <button
                      className={r.isActive ? "text-danger hover:underline" : "text-success hover:underline"}
                      onClick={() => run(() => setExpenseCategoryActive(r.id, !r.isActive))}
                    >
                      {r.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-text-muted">
        Deactivated categories disappear from the Add Expense form but stay on old expenses.
      </p>
    </div>
  );
}

// ---------- Backup ----------

export function BackupPanel({ isOwner, exportKinds }: { isOwner: boolean; exportKinds: string[] }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getBackupInfo>> | null>(null);
  useEffect(() => {
    if (isOwner) getBackupInfo().then(setInfo).catch(() => setInfo(null));
  }, [isOwner]);

  const exports = [
    { kind: "products", label: "Products & stock (CSV)" },
    { kind: "sales", label: "Sales (CSV)" },
    { kind: "customers", label: "Customers (CSV)" },
    { kind: "expenses", label: "Expenses (CSV)" },
  ].filter((e) => exportKinds.includes(e.kind));

  if (!isOwner && exports.length === 0) {
    return <p className="text-sm text-text-muted">You don't have any data you're allowed to export.</p>;
  }

  return (
    <div className="space-y-4">
      {isOwner && (
      <div className="rounded-md border border-border p-4">
        <div className="mb-1 text-sm font-semibold text-text">Full backup</div>
        <p className="mb-3 text-xs text-text-muted">
          Every record in one JSON file
          {info
            ? ` (${info.products} products, ${info.variants} variants, ${info.sales} sales, ${info.customers} customers, ${info.expenses} expenses, ${info.users} users)`
            : ""}
          . Password hashes are not included.
        </p>
        <a href="/api/backup/full">
          <Button type="button">Download full backup</Button>
        </a>
      </div>
      )}

      <div className="rounded-md border border-border p-4">
        <div className="mb-2 text-sm font-semibold text-text">Export for Excel</div>
        <div className="flex flex-wrap gap-2">
          {exports.map((e) => (
            <a key={e.kind} href={`/api/backup/${e.kind}`}>
              <Button variant="secondary" type="button">{e.label}</Button>
            </a>
          ))}
        </div>
      </div>

      {isOwner && (
      <div className="rounded-md border border-border bg-zinc-50 p-4 text-xs text-text-muted">
        <div className="mb-1 text-sm font-semibold text-text">Restore &amp; import</div>
        Restoring a backup is deliberately not a button here, because a wrong restore could overwrite live sales.
        Your database is hosted on Neon, which keeps point-in-time history: restore from the Neon console (Branches /
        Restore) or ask your developer to import the JSON file.
      </div>
      )}
    </div>
  );
}

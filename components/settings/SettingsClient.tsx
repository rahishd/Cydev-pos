"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { saveSettingsSection, type SettingsPageData } from "@/app/(dashboard)/settings/actions";
import {
  SETTINGS_SECTIONS,
  type SettingField,
  type SettingValue,
  type SettingsSection,
} from "@/lib/settings-schema";
import { BackupPanel, ExpenseCategoriesPanel, LogoPanel } from "./SettingsPanels";
import { PushPanel } from "./PushPanel";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-orange-500" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: SettingValue;
  onChange: (v: SettingValue) => void;
}) {
  const note = (
    <>
      {field.help && <p className="mt-1 text-xs text-text-muted">{field.help}</p>}
      {!field.applied && field.type !== "select" && (
        <p className="mt-1 text-[11px] text-text-muted/70">Saved, but not enforced by the app yet.</p>
      )}
    </>
  );

  if (field.type === "toggle") {
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div>
          <div className="text-sm font-medium text-text">{field.label}</div>
          {note}
        </div>
        <Toggle checked={Boolean(value)} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="py-3">
      <Label>{field.label}</Label>
      {field.type === "select" ? (
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)} disabled={field.options?.length === 1}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      ) : field.type === "textarea" ? (
        <textarea
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full glass-input text-sm text-text"
        />
      ) : field.type === "list" ? (
        <textarea
          value={(value as string[]).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          rows={4}
          className="w-full glass-input text-sm text-text"
        />
      ) : field.type === "number" ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={String(value)}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className="max-w-40"
          />
          {field.suffix && <span className="text-sm text-text-muted">{field.suffix}</span>}
        </div>
      ) : (
        <Input
          type={field.type === "time" ? "time" : "text"}
          value={String(value)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={field.type === "time" ? "max-w-40" : undefined}
        />
      )}
      {note}
    </div>
  );
}

function SectionForm({
  section,
  initial,
}: {
  section: SettingsSection;
  initial: Record<string, SettingValue>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, SettingValue>>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = useMemo(
    () => section.fields.some((f) => JSON.stringify(values[f.key]) !== JSON.stringify(initial[f.key])),
    [values, initial, section.fields]
  );

  if (section.fields.length === 0) return null;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveSettingsSection(section.id, values);
      setMsg({ ok: true, text: res.changed ? "Saved." : "Nothing changed." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="divide-y divide-border">
        {section.fields
          .filter((f) => !f.showIf || Boolean(values[f.showIf]))
          .map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => {
                setMsg(null);
                setValues((prev) => ({ ...prev, [f.key]: v }));
              }}
            />
          ))}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => { setValues(initial); setMsg(null); }}>
            Discard
          </Button>
        )}
        {msg && <span className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function SettingsClient({ data }: { data: SettingsPageData }) {
  const available = SETTINGS_SECTIONS.filter((s) => data.sections.includes(s.id));
  const [activeId, setActiveId] = useState(available[0]?.id);
  const section = available.find((s) => s.id === activeId) ?? available[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Settings</h1>
        <p className="text-sm text-text-muted">
          Settings control how the system behaves. Who can do what is managed under Users.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="h-fit shrink-0 p-2 lg:w-60">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {available.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm ${
                  s.id === section.id ? "bg-orange-500/15 font-semibold text-accent" : "text-text hover:bg-zinc-100/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </Card>

        <Card className="min-w-0 flex-1 p-5">
          <h2 className="text-base font-semibold text-text">{section.label}</h2>
          <p className="mb-4 text-sm text-text-muted">{section.description}</p>

          <div className="space-y-4">
            {section.custom === "push" && data.canPush && <PushPanel />}
            {section.custom === "logo" && <LogoPanel key={String(data.settings.business.logo ?? "")} logo={data.settings.business.logo} />}
            <SectionForm
              key={section.id + JSON.stringify(data.settings[section.id])}
              section={section}
              initial={data.settings[section.id]}
            />
            {section.custom === "expenseCategories" && <ExpenseCategoriesPanel />}
            {section.custom === "backup" && <BackupPanel isOwner={data.isOwner} exportKinds={data.exportKinds} />}
          </div>
        </Card>
      </div>
    </div>
  );
}

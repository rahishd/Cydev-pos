/** Reports use Nepal calendar days (UTC+5:45, no daylight saving), whatever timezone the server runs in. */
export const NEPAL_OFFSET_MIN = 345;

export type Preset = "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This week" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};

/** Today's date in Nepal as YYYY-MM-DD. */
export function nepalToday(now: Date = new Date()): string {
  return ymd(new Date(now.getTime() + NEPAL_OFFSET_MIN * 60000));
}

/** The Nepal calendar day a moment falls on. */
export function nepalDay(d: Date): string {
  return ymd(new Date(d.getTime() + NEPAL_OFFSET_MIN * 60000));
}

export function presetRange(preset: Preset, today: string = nepalToday()): { from: string; to: string } {
  const t = parse(today);
  switch (preset) {
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "thisWeek":
      // Weeks start on Sunday, matching the Dashboard.
      return { from: addDays(today, -t.getUTCDay()), to: today };
    case "thisMonth":
      return { from: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`, to: today };
    case "lastMonth": {
      const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return { from: ymd(first), to: ymd(last) };
    }
    case "thisYear":
      return { from: `${t.getUTCFullYear()}-01-01`, to: today };
    default:
      return { from: today, to: today };
  }
}

/** Start (inclusive) and end (exclusive) instants for a Nepal day range. */
export function toInstants(from: string, to: string): { start: Date; end: Date } {
  const offset = NEPAL_OFFSET_MIN * 60000;
  return {
    start: new Date(parse(from).getTime() - offset),
    end: new Date(parse(to).getTime() + 86400000 - offset),
  };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000) + 1;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

const fmt = (s: string) => parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function periodLabel(from: string, to: string): string {
  return from === to ? fmt(from) : `${fmt(from)} to ${fmt(to)}`;
}

export function isValidDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
}

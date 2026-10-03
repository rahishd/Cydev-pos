export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NP", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000;

/** Midnight (Nepal time) at the start of today, as a UTC instant. Servers run in UTC, so "today" needs this. */
export function nepalDayStart(daysAgo = 0, from = new Date()): Date {
  const local = new Date(from.getTime() + NEPAL_OFFSET_MS);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo);
  return new Date(startLocal - NEPAL_OFFSET_MS);
}

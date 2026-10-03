import type { ColFmt, Row } from "@/lib/reports/types";

const TZ = "Asia/Kathmandu";

export const fmtMoney = (n: number) =>
  `NPR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function fmtCell(value: Row[string] | undefined, fmt: ColFmt = "text"): string {
  if (value === null || value === undefined || value === "") return "-";
  switch (fmt) {
    case "money":
      return fmtMoney(Number(value));
    case "int":
      return Number(value).toLocaleString("en-US");
    case "pct":
      return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
    case "date":
      return new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
    case "datetime":
      return new Date(String(value)).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
    default:
      return String(value);
  }
}

export const isNumericFmt = (fmt?: ColFmt) => fmt === "money" || fmt === "int" || fmt === "pct";

export function fmtCard(value: number, fmt: "money" | "int" | "pct"): string {
  return fmtCell(value, fmt);
}

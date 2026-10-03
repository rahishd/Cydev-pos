"use client";

import { useEffect, useRef, useState } from "react";
import NepaliDate from "nepali-date-converter";
import { cn } from "@/lib/utils";

const MONTHS_EN = [
  "Baishakh", "Jestha", "Aashadha", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];
const MONTHS_NP = [
  "बैशाख", "जेठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
  "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र",
];
const DAYS_NP = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_SHORT_NP = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"];

const toNp = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)]);

type Cell = { bs: number; ad: Date };

function buildMonth(year: number, month: number) {
  const first = new NepaliDate(year, month, 1);
  let days = 29;
  for (const d of [30, 31, 32]) {
    const x = new NepaliDate(year, month, d);
    if (x.getMonth() === month && x.getDate() === d) days = d;
  }
  const cells: Cell[] = [];
  const start = first.toJsDate();
  for (let i = 0; i < days; i++) {
    const ad = new Date(start);
    ad.setDate(start.getDate() + i);
    cells.push({ bs: i + 1, ad });
  }
  return { cells, offset: first.getDay() };
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function NepaliCalendar({ onColor = false }: { onColor?: boolean }) {
  const [today, setToday] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    const n = new NepaliDate(now);
    setView({ y: n.getYear(), m: n.getMonth() });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!today || !view) return <div className="h-9 w-48" />;

  const nt = new NepaliDate(today);
  const adLabel = today.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const shift = (delta: number) => {
    let m = view.m + delta;
    let y = view.y;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    try {
      new NepaliDate(y, m, 1);
      setView({ y, m });
    } catch {
      /* outside supported range */
    }
  };

  const { cells, offset } = buildMonth(view.y, view.m);
  const isCurrentMonth = view.y === nt.getYear() && view.m === nt.getMonth();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("flex flex-col items-start rounded-md px-2 py-1 text-left leading-tight", onColor ? "hover:bg-white/10" : "hover:bg-zinc-100/60")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn("text-sm font-semibold", onColor ? "text-white" : "text-text")}>
          {toNp(nt.getDate())} {MONTHS_NP[nt.getMonth()]} {toNp(nt.getYear())}, {DAYS_NP[nt.getDay()]}
        </span>
        <span className={cn("text-xs", onColor ? "text-white/80" : "text-text-muted")}>
          {MONTHS_EN[nt.getMonth()]} {nt.getDate()}, {nt.getYear()} BS &nbsp;·&nbsp; {adLabel}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded px-2 py-1 text-text-muted hover:bg-zinc-100"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="text-center leading-tight">
              <div className="text-sm font-semibold text-text">
                {MONTHS_NP[view.m]} {toNp(view.y)}
              </div>
              <div className="text-xs text-text-muted">
                {MONTHS_EN[view.m]} {view.y} BS
              </div>
            </div>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded px-2 py-1 text-text-muted hover:bg-zinc-100"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS_SHORT.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "pb-1 text-[11px] font-medium leading-tight",
                  i === 6 ? "text-danger" : "text-text-muted"
                )}
              >
                {DAYS_SHORT_NP[i]}
                <div className="text-[9px] font-normal opacity-70">{d}</div>
              </div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {cells.map((c) => {
              const isToday = sameDay(c.ad, today);
              const isSat = c.ad.getDay() === 6;
              return (
                <div
                  key={c.bs}
                  className={cn(
                    "rounded-md py-1 leading-tight",
                    isToday ? "bg-accent text-white" : isSat ? "text-danger" : "text-text"
                  )}
                >
                  <div className="text-sm font-medium">{toNp(c.bs)}</div>
                  <div className={cn("text-[9px]", isToday ? "text-white/80" : "text-text-muted")}>
                    {c.ad.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setView({ y: nt.getYear(), m: nt.getMonth() })}
              className="mt-3 w-full rounded-md border border-border py-1 text-xs font-medium text-text hover:bg-zinc-100"
            >
              Back to today
            </button>
          )}
        </div>
      )}
    </div>
  );
}

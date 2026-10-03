"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/layout/Icon";
import { getRecentActivity, type ActivityItem } from "@/app/(dashboard)/activity-actions";

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Bell with a list of recent activity. "New" is counted from the last time this person opened it. */
export function ActivityBell({ userKey, canOpenLog, onColor }: { userKey: string; canOpenLog: boolean; onColor?: boolean }) {
  const storeKey = `activity-seen:${userKey}`;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [seenAt, setSeenAt] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getRecentActivity());
    } catch {
      // Offline or signed out: keep what is already shown.
    }
  }, []);

  useEffect(() => {
    let saved: number | null = null;
    try {
      const v = localStorage.getItem(storeKey);
      saved = v ? Number(v) : null;
    } catch {}
    // First ever visit: start from now, so a new person isn't greeted by a pile of old "new" items.
    if (saved === null) {
      saved = Date.now();
      try {
        localStorage.setItem(storeKey, String(saved));
      } catch {}
    }
    setSeenAt(saved);
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, storeKey]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isNew = (i: ActivityItem) => !i.mine && seenAt !== null && new Date(i.at).getTime() > seenAt;
  const unread = items.filter(isNew).length;

  const toggle = () => {
    if (!open) {
      load();
    } else {
      const now = Date.now();
      setSeenAt(now);
      try {
        localStorage.setItem(storeKey, String(now));
      } catch {}
    }
    setOpen(!open);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Recent activity, ${unread} new` : "Recent activity"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${onColor ? "text-white active:bg-white/20" : "text-text hover:bg-zinc-100"}`}
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-lg border border-border bg-surface text-text shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-text">Recent activity</div>
            {canOpenLog && (
              <Link href="/audit-log" onClick={() => setOpen(false)} className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">Nothing has happened yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((i) => (
                  <li key={i.id} className="flex gap-3 px-4 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew(i) ? "bg-accent" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium capitalize text-text">{i.title}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(i.at)}</span>
                      </div>
                      {i.description && <p className="mt-0.5 text-xs text-text-muted">{i.description}</p>}
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {i.who} · {i.module}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

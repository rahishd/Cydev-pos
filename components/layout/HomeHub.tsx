"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/layout/Icon";
import { HOME_GROUPS, canSee, type Tile } from "@/components/layout/nav-config";
import { formatCurrency } from "@/lib/date-utils";

type Summary = { todaySales: number; todayCount: number } | null;

const HIDE_KEY = "home-hide-amounts";

function TileLink({ tile }: { tile: Tile }) {
  return (
    <Link
      href={tile.href}
      className="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-zinc-700 transition-opacity active:opacity-60"
    >
      <span className="flex h-11 w-11 items-center justify-center text-zinc-600">
        <Icon name={tile.icon} className="h-7 w-7" />
      </span>
      <span className="leading-tight">{tile.label}</span>
    </Link>
  );
}

export function HomeHub({
  summary,
  isOwner,
  permissions,
}: {
  summary: Summary;
  isOwner: boolean;
  permissions: string[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  // The card home is for phones; on a wide screen go to the regular dashboard.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace("/dashboard");
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, [router]);

  const toggle = () => {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !h;
    });
  };

  const groups = HOME_GROUPS.map((g) => ({
    ...g,
    tiles: g.tiles.filter((t) => canSee(t, isOwner, permissions)),
  })).filter((g) => g.tiles.length > 0);

  // First four useful shortcuts for the quick-action row.
  const quick = [
    { label: "New Sale", href: "/sales?tab=pos", icon: "cart" as const, anyOf: ["sales.create"] },
    { label: "Sales History", href: "/sales?tab=history", icon: "history" as const, anyOf: ["sales.history"] },
    { label: "Add Expense", href: "/expenses", icon: "expenses" as const, anyOf: ["expenses.add"] },
    { label: "Products", href: "/products", icon: "products" as const, anyOf: ["products.view"] },
    { label: "Customers", href: "/customers", icon: "customers" as const, anyOf: ["customers.view"] },
    { label: "Inventory", href: "/inventory", icon: "inventory" as const, anyOf: ["inventory.view"] },
  ]
    .filter((q) => canSee(q, isOwner, permissions))
    .slice(0, 4);

  const mask = (v: string) => (hidden ? "XXXX.XX" : v);

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100vh-4rem)] bg-[#f3f5f7] pb-8 lg:hidden">
      <div className="-mt-10 space-y-3 px-3">
        <section className="rounded-2xl bg-white shadow-sm">
          {summary && (
            <div className="flex items-center rounded-t-2xl bg-zinc-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Today&apos;s Sales</div>
                <div className="text-lg font-bold leading-tight text-zinc-900">
                  <span className="mr-1 text-xs font-semibold text-zinc-500">NPR</span>
                  {mask(formatCurrency(summary.todaySales))}
                </div>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label={hidden ? "Show amounts" : "Hide amounts"}
                className="mx-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm active:scale-95"
              >
                <Icon name={hidden ? "eyeOff" : "eye"} className="h-6 w-6" />
              </button>
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Transactions</div>
                <div className="text-xl font-bold text-zinc-900">{mask(String(summary.todayCount))}</div>
              </div>
            </div>
          )}
          {quick.length > 0 && (
            <div className="grid grid-cols-4 gap-2 px-2 py-4">
              {quick.map((q) => (
                <TileLink key={q.label} tile={q} />
              ))}
            </div>
          )}
        </section>

        {groups.map((g) => (
          <section key={g.title} className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-zinc-900">{g.title}</h2>
            <div className="grid grid-cols-4 gap-y-4">
              {g.tiles.map((t) => (
                <TileLink key={t.label} tile={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/layout/Icon";
import { NepaliCalendar } from "@/components/layout/NepaliCalendar";
import { Weather } from "@/components/layout/Weather";
import { Avatar } from "@/components/layout/Avatar";
import { ActivityBell } from "@/components/layout/ActivityBell";
import { HOME_GROUPS, canSee, pageTitle } from "@/components/layout/nav-config";
import { logoutAction } from "@/lib/session-actions";
import { useSettings } from "@/components/providers/SettingsProvider";

type Props = {
  isOwner: boolean;
  permissions: string[];
  userName: string;
  userRole: string;
};

const HEADER_BG = "bg-gradient-to-br from-orange-500 to-orange-600";

/** Phone-only top bar: a large greeting on the home screen, a compact back bar everywhere else. */
export function MobileHeader({
  userName,
  userRole,
  userKey,
  canOpenLog,
  avatarVersion,
}: Pick<Props, "userName" | "userRole"> & { userKey: string; canOpenLog: boolean; avatarVersion: number }) {
  const pathname = usePathname();
  const isHome = pathname === "/home";
  const { business } = useSettings();
  const logo = String(business.logo ?? "/logo.png");
  const first = userName.trim().split(/\s+/)[0] || "there";

  if (isHome) {
    return (
      <header className={cn("relative px-4 pb-4 pt-4 text-white lg:hidden", HEADER_BG, "rounded-b-[2rem]")}>
        <div className="flex items-center gap-3">
          <Link href="/profile" aria-label="My profile">
            <Avatar id={userKey} name={userName} version={avatarVersion} className="h-11 w-11 text-lg" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-lg font-semibold">Hi, {userName.trim() || "there"}</div>
            <div className="text-xs text-white/80">
              {userRole === "OWNER" ? "Owner" : "Staff"}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="absolute right-[5.25rem] top-4">
            <ActivityBell userKey={userKey} canOpenLog={canOpenLog} onColor />
          </div>
          <div className="absolute right-4 top-4 flex w-[60px] flex-col items-center gap-1.5">
            <img src={logo} alt={String(business.shopName)} className="h-[60px] w-[60px] rounded-xl bg-[#ffffff] object-contain p-1" />
            <Weather className="whitespace-nowrap rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white" />
          </div>
        </div>
        <div className="mt-2 -ml-2">
          <NepaliCalendar onColor />
        </div>
      </header>
    );
  }

  return (
    <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-2 px-2 text-white lg:hidden", HEADER_BG)}>
      <Link
        href="/home"
        aria-label="Back to home"
        className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/20"
      >
        <Icon name="back" className="h-6 w-6" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{pageTitle(pathname)}</h1>
      <ActivityBell userKey={userKey} canOpenLog={canOpenLog} onColor />
    </header>
  );
}

type Slot = { label: string; href: string; icon: Parameters<typeof Icon>[0]["name"]; match: string; gate: Parameters<typeof canSee>[0] };

const SLOTS: Slot[] = [
  { label: "Products", href: "/products", icon: "products", match: "/products", gate: { anyOf: ["products.view"] } },
  { label: "Customers", href: "/customers", icon: "customers", match: "/customers", gate: { anyOf: ["customers.view"] } },
  { label: "Inventory", href: "/inventory", icon: "inventory", match: "/inventory", gate: { anyOf: ["inventory.view"] } },
  { label: "Expenses", href: "/expenses", icon: "expenses", match: "/expenses", gate: { anyOf: ["expenses.view"] } },
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", match: "/dashboard", gate: { anyOf: ["dashboard.view"] } },
];

function BarLink({ href, icon, label, active }: { href: string; icon: Slot["icon"]; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium">
      <span
        className={cn(
          "flex h-9 w-12 items-center justify-center rounded-xl transition-colors",
          active ? "bg-orange-100 text-orange-600" : "text-zinc-500"
        )}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <span className={active ? "text-orange-600" : "text-zinc-500"}>{label}</span>
    </Link>
  );
}

/** Phone-only bottom bar: Home, two shortcuts, a big New Sale button, and More. */
export function MobileBottomNav({ isOwner, permissions, userName }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const shortcuts = SLOTS.filter((s) => canSee(s.gate, isOwner, permissions)).slice(0, 2);
  const canSell = canSee({ anyOf: ["sales.create"] }, isOwner, permissions);
  const [left, right] = shortcuts;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="relative mx-auto flex max-w-md items-end px-1">
          <BarLink href="/home" icon="home" label="Home" active={pathname === "/home"} />
          {left ? <BarLink href={left.href} icon={left.icon} label={left.label} active={pathname.startsWith(left.match)} /> : <div className="flex-1" />}

          <div className="flex flex-1 justify-center">
            {canSell ? (
              <Link
                href="/sales?tab=pos"
                aria-label="New sale"
                className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg active:scale-95"
              >
                <Icon name="cart" className="h-7 w-7" />
              </Link>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {right ? <BarLink href={right.href} icon={right.icon} label={right.label} active={pathname.startsWith(right.match)} /> : <div className="flex-1" />}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium"
          >
            <span className={cn("flex h-9 w-12 items-center justify-center rounded-xl", moreOpen ? "bg-orange-100 text-orange-600" : "text-zinc-500")}>
              <Icon name="more" className="h-6 w-6" />
            </span>
            <span className={moreOpen ? "text-orange-600" : "text-zinc-500"}>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900">All pages</div>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-1 text-zinc-500 active:bg-zinc-100">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-y-4">
              {[{ label: "Home", href: "/home", icon: "home" as const }, ...HOME_GROUPS.flatMap((g) => g.tiles).filter((t) => canSee(t, isOwner, permissions))].map((t) => (
                <Link key={t.href + t.label} href={t.href} className="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-zinc-700 active:opacity-60">
                  <span className="flex h-11 w-11 items-center justify-center text-zinc-600">
                    <Icon name={t.icon} className="h-7 w-7" />
                  </span>
                  <span className="leading-tight">{t.label}</span>
                </Link>
              ))}
            </div>

            <Link href="/profile" className="mt-5 flex w-full items-center justify-center rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-50">
              My profile &amp; photo
            </Link>

            <form action={logoutAction} className="mt-3">
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-red-600 active:bg-red-50">
                <Icon name="logout" className="h-5 w-5" />
                Sign out ({userName.split(" ")[0]})
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

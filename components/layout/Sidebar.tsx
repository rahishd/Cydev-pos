"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, canSee } from "@/components/layout/nav-config";

export function Sidebar({
  isOwner,
  permissions,
  shopName,
  logo,
}: {
  isOwner: boolean;
  permissions: string[];
  shopName: string;
  logo: string;
}) {
  const visible = NAV_ITEMS.filter((item) => canSee(item, isOwner, permissions));

  return (
    <aside className="hidden w-56 shrink-0 lg:flex flex-col glass-container border-r border-r-white/30 rounded-none">
      <div className="flex items-center gap-2.5 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={shopName} className="h-9 w-9 rounded-md object-contain" />
        <span className="text-sm font-semibold leading-tight text-text">{shopName}</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {visible.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-disabled={!item.enabled}
            className={cn(
              "block rounded-md px-3 py-1.5 text-sm",
              item.enabled
                ? "text-text hover:bg-zinc-100"
                : "cursor-not-allowed text-text-muted/50"
            )}
            onClick={(e) => {
              if (!item.enabled) e.preventDefault();
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

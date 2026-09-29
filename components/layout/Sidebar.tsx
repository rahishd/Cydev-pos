"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Products", href: "#", enabled: false },
  { label: "Inventory", href: "#", enabled: false },
  { label: "Purchases", href: "#", enabled: false },
  { label: "Suppliers", href: "#", enabled: false },
  { label: "Sales / POS", href: "#", enabled: false },
  { label: "Customers", href: "#", enabled: false },
  { label: "Expenses", href: "#", enabled: false },
  { label: "Reports", href: "#", enabled: false },
  { label: "Users", href: "#", enabled: false },
  { label: "Audit Log", href: "#", enabled: false },
  { label: "Settings", href: "#", enabled: false },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-4 py-4 text-sm font-semibold text-text">
        Bag &amp; Shoes
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => (
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

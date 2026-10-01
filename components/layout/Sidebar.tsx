"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Products", href: "/products", enabled: true },
  { label: "Inventory", href: "/inventory", enabled: true },
  { label: "Purchases", href: "/purchases", enabled: true },
  { label: "Sales / POS", href: "/sales", enabled: true },
  { label: "Customers", href: "/customers", enabled: true },
  { label: "Expenses", href: "/expenses", enabled: true },
  { label: "Reports", href: "#", enabled: false },
  { label: "Users", href: "/users", enabled: true },
  { label: "Audit Log", href: "#", enabled: false },
  { label: "Settings", href: "#", enabled: false },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col glass-container border-r border-r-white/30 rounded-none">
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

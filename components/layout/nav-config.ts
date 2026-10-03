import type { IconName } from "@/components/layout/Icon";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  /** false = listed in the desktop sidebar as "coming soon" but hidden on the mobile home. */
  enabled: boolean;
  /** Visible when the user holds any of these permissions. */
  anyOf?: string[];
  /** Visible when the user holds any permission starting with "prefix.". */
  prefix?: string;
  ownerOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard", enabled: true, anyOf: ["dashboard.view"] },
  { id: "products", label: "Products", href: "/products", icon: "products", enabled: true, anyOf: ["products.view"] },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: "inventory", enabled: true, anyOf: ["inventory.view"] },
  { id: "purchases", label: "Purchases", href: "/purchases", icon: "purchases", enabled: true, anyOf: ["purchases.view"] },
  {
    id: "sales",
    label: "Sales / POS",
    href: "/sales",
    icon: "sales",
    enabled: true,
    anyOf: ["sales.create", "sales.history", "sales.return", "sales.exchange"],
  },
  { id: "customers", label: "Customers", href: "/customers", icon: "customers", enabled: true, anyOf: ["customers.view"] },
  { id: "expenses", label: "Expenses", href: "/expenses", icon: "expenses", enabled: true, anyOf: ["expenses.view"] },
  { id: "reports", label: "Reports", href: "#", icon: "reports", enabled: false, prefix: "reports" },
  { id: "users", label: "Users", href: "/users", icon: "users", enabled: true, ownerOnly: true },
  { id: "audit", label: "Audit Log", href: "/audit-log", icon: "audit", enabled: true, anyOf: ["audit.view"] },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings", enabled: true, prefix: "settings" },
];

export type Gate = Pick<NavItem, "anyOf" | "prefix" | "ownerOnly">;

export function canSee(item: Gate, isOwner: boolean, permissions: string[]): boolean {
  if (isOwner) return true;
  if (item.ownerOnly) return false;
  if (item.anyOf) return item.anyOf.some((p) => permissions.includes(p));
  if (item.prefix) return permissions.some((p) => p.startsWith(item.prefix + "."));
  return true;
}

export type Tile = Gate & { label: string; href: string; icon: IconName };

export type TileGroup = { title: string; tiles: Tile[] };

const byId = (id: string): Tile => {
  const n = NAV_ITEMS.find((i) => i.id === id)!;
  return { label: n.label, href: n.href, icon: n.icon, anyOf: n.anyOf, prefix: n.prefix, ownerOnly: n.ownerOnly };
};

/** The cards shown on the mobile home screen. Every page in the app appears here. */
export const HOME_GROUPS: TileGroup[] = [
  { title: "Overview", tiles: [byId("dashboard")] },
  {
    title: "Sales & Customers",
    tiles: [
      { label: "New Sale", href: "/sales?tab=pos", icon: "cart", anyOf: ["sales.create"] },
      { label: "Sales History", href: "/sales?tab=history", icon: "history", anyOf: ["sales.history"] },
      { label: "Returns", href: "/sales?tab=returns", icon: "returns", anyOf: ["sales.return", "sales.exchange"] },
      byId("customers"),
    ],
  },
  { title: "Stock & Purchases", tiles: [byId("products"), byId("inventory"), byId("purchases")] },
  { title: "Money", tiles: [byId("expenses")] },
  { title: "Administration", tiles: [byId("users"), byId("audit"), byId("settings")] },
];

export function pageTitle(pathname: string): string {
  if (pathname === "/home") return "Home";
  if (pathname.startsWith("/forbidden")) return "No access";
  const hit = NAV_ITEMS.filter((i) => i.href !== "#" && pathname.startsWith(i.href)).sort(
    (a, b) => b.href.length - a.href.length
  )[0];
  return hit?.label ?? "Back";
}

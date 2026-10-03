import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "dashboard"
  | "products"
  | "inventory"
  | "purchases"
  | "sales"
  | "cart"
  | "history"
  | "returns"
  | "customers"
  | "expenses"
  | "users"
  | "audit"
  | "settings"
  | "reports"
  | "more"
  | "plus"
  | "eye"
  | "eyeOff"
  | "logout"
  | "back"
  | "close"
  | "bell";

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  inventory: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  purchases: (
    <>
      <path d="M1.5 5h12.5v11H1.5z" />
      <path d="M14 9h4l4 4v3h-8" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17.5" cy="18.5" r="1.8" />
    </>
  ),
  sales: (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.4 11h10.2l2-8H6" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  returns: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M17 14c2.8 0 4.5 2 4.5 5" />
    </>
  ),
  expenses: (
    <>
      <path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path d="M3 7l2.5-3.5h11" />
      <path d="M16 14h3" />
    </>
  ),
  users: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.5 16c.7-1.8 2-2.5 3.5-2.5s2.8.7 3.5 2.5" />
    </>
  ),
  audit: (
    <>
      <path d="M9 3h6v3H9z" />
      <path d="M7 5H5v16h14V5h-2" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-5" />
      <path d="M13 16V8" />
      <path d="M18 16v-3" />
    </>
  ),
  more: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5V3h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
};

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

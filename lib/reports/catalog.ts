import type { FilterKey } from "@/lib/reports/types";

export type ReportDef = {
  key: string;
  label: string;
  group: string;
  /** Any one of these permissions unlocks the report. */
  needs: string[];
  /** Which filters mean something for this report. */
  filters: FilterKey[];
  /** As-of-now reports ignore the date range. */
  asOf?: boolean;
};

const SALES = ["reports.sales"];
const PROFIT = ["reports.gross_profit", "reports.net_profit"];
const INV = ["reports.inventory"];

export const REPORTS: ReportDef[] = [
  { key: "overview", label: "Overview", group: "Overview", needs: [], filters: [] },

  { key: "sales.summary", label: "Sales Summary", group: "Sales", needs: SALES, filters: ["category", "brand", "staff", "customer", "method"] },
  { key: "sales.product", label: "Sales by Product", group: "Sales", needs: SALES, filters: ["category", "brand", "staff", "customer", "method"] },
  { key: "sales.category", label: "Sales by Category", group: "Sales", needs: SALES, filters: ["brand", "staff", "customer", "method"] },
  { key: "sales.brand", label: "Sales by Brand", group: "Sales", needs: SALES, filters: ["category", "staff", "customer", "method"] },
  { key: "sales.staff", label: "Sales by Staff", group: "Sales", needs: SALES, filters: ["category", "brand", "customer", "method"] },

  { key: "profit.summary", label: "Profit Summary", group: "Profit", needs: PROFIT, filters: ["category", "brand", "staff"] },
  { key: "profit.product", label: "Profit by Product", group: "Profit", needs: PROFIT, filters: ["category", "brand", "staff"] },
  { key: "profit.category", label: "Profit by Category", group: "Profit", needs: PROFIT, filters: ["brand", "staff"] },
  { key: "profit.brand", label: "Profit by Brand", group: "Profit", needs: PROFIT, filters: ["category", "staff"] },
  { key: "profit.date", label: "Profit by Date", group: "Profit", needs: PROFIT, filters: ["category", "brand", "staff"] },

  { key: "inventory.current", label: "Current Stock", group: "Inventory", needs: INV, filters: ["category", "brand", "supplier"], asOf: true },
  { key: "inventory.valuation", label: "Stock Valuation", group: "Inventory", needs: INV, filters: ["category", "brand", "supplier"], asOf: true },
  { key: "inventory.movement", label: "Stock Movement", group: "Inventory", needs: INV, filters: ["category", "brand"] },
  { key: "inventory.low", label: "Low Stock", group: "Inventory", needs: INV, filters: ["category", "brand", "supplier"], asOf: true },
  { key: "inventory.out", label: "Out of Stock", group: "Inventory", needs: INV, filters: ["category", "brand", "supplier"], asOf: true },
  { key: "inventory.adjustments", label: "Stock Adjustments", group: "Inventory", needs: INV, filters: ["category", "brand"] },

  { key: "products.fast", label: "Fast Moving", group: "Products", needs: INV, filters: ["category", "brand"] },
  { key: "products.slow", label: "Slow Moving", group: "Products", needs: INV, filters: ["category", "brand"] },


  { key: "customers.summary", label: "Customer Summary", group: "Customers", needs: ["reports.customers"], filters: [] },
  { key: "customers.top", label: "Top Customers", group: "Customers", needs: ["reports.customers"], filters: [] },
  { key: "customers.credit", label: "Customer Credit", group: "Customers", needs: ["reports.customers"], filters: ["customer"], asOf: true },

  { key: "payments", label: "Payments", group: "Money", needs: SALES, filters: ["staff", "customer"] },
  { key: "expenses", label: "Expenses", group: "Money", needs: ["reports.expense"], filters: ["staff", "method"] },
  { key: "returns", label: "Returns & Exchanges", group: "Money", needs: SALES, filters: ["staff", "customer"] },
  { key: "discounts", label: "Discounts", group: "Money", needs: SALES, filters: ["category", "brand", "staff", "customer"] },

  { key: "staff.activity", label: "Staff Activity", group: "Team", needs: ["reports.staff"], filters: ["staff"] },
  { key: "closing.daily", label: "Daily Closing", group: "Team", needs: ["reports.financial"], filters: [] },
];

export const REPORT_GROUPS = [...new Set(REPORTS.map((r) => r.group))];

export function reportDef(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}

/** The Overview opens for anyone who can see at least one other report. */
export function canOpenReport(def: ReportDef, can: (p: string) => boolean): boolean {
  if (def.key === "overview") return REPORTS.some((r) => r.key !== "overview" && canOpenReport(r, can));
  return def.needs.some((p) => can(p));
}

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "ESEWA", label: "eSewa" },
  { value: "KHALTI", label: "Khalti" },
  { value: "FONEPAY", label: "Fonepay" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT", label: "Customer Credit" },
  { value: "OTHER", label: "Other" },
];

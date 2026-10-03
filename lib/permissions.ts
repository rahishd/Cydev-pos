export type PermissionItem = { key: string; label: string };
export type PermissionGroup = {
  key: string;
  label: string;
  /** Turning on any item in the group also turns this one on; turning it off clears the group. */
  viewKey?: string;
  items: PermissionItem[];
};

// Staff-assignable permissions. User management is Owner-only and is deliberately not listed.
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    items: [{ key: "dashboard.view", label: "View Dashboard" }],
  },
  {
    key: "products",
    label: "Products",
    viewKey: "products.view",
    items: [
      { key: "products.view", label: "View Products" },
      { key: "products.add", label: "Add Product" },
      { key: "products.edit", label: "Edit Product" },
      { key: "products.edit_price", label: "Edit Product Price" },
      { key: "products.delete", label: "Delete / Deactivate Product" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    viewKey: "inventory.view",
    items: [
      { key: "inventory.view", label: "View Inventory" },
      { key: "inventory.add_stock", label: "Add Stock" },
      { key: "inventory.adjust", label: "Stock Adjustment" },
      { key: "inventory.count", label: "Stock Count" },
      { key: "inventory.history", label: "View Stock History" },
    ],
  },
  {
    key: "sales",
    label: "Sales / POS",
    items: [
      { key: "sales.create", label: "Create Sale" },
      { key: "sales.edit_cart", label: "Edit Cart" },
      { key: "sales.discount", label: "Apply Discount" },
      { key: "sales.cancel", label: "Cancel Sale" },
      { key: "sales.return", label: "Process Return" },
      { key: "sales.exchange", label: "Process Exchange" },
      { key: "sales.history", label: "View Sales History" },
      { key: "sales.online_payment", label: "Collect Online (QR) Payments" },
      { key: "sales.share", label: "Share / Download Invoice PDF" },
    ],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    viewKey: "suppliers.view",
    items: [
      { key: "suppliers.view", label: "View Suppliers" },
      { key: "suppliers.add", label: "Add Supplier" },
      { key: "suppliers.edit", label: "Edit Supplier" },
      { key: "suppliers.balance", label: "View Supplier Balance" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    viewKey: "customers.view",
    items: [
      { key: "customers.view", label: "View Customers" },
      { key: "customers.add", label: "Add Customer" },
      { key: "customers.edit", label: "Edit Customer" },
      { key: "customers.history", label: "View Customer Purchase History" },
      { key: "customers.credit", label: "Manage Customer Credit" },
    ],
  },
  {
    key: "expenses",
    label: "Expenses",
    viewKey: "expenses.view",
    items: [
      { key: "expenses.view", label: "View Expenses" },
      { key: "expenses.add", label: "Add Expense" },
      { key: "expenses.edit", label: "Edit Expense" },
      { key: "expenses.delete", label: "Delete Expense" },
      { key: "expenses.export", label: "Share Voucher / Export Expense Report" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    items: [
      { key: "reports.sales", label: "Sales Reports" },
      { key: "reports.inventory", label: "Inventory Reports" },
      { key: "reports.expense", label: "Expense Reports" },
      { key: "reports.gross_profit", label: "Gross Profit Reports" },
      { key: "reports.net_profit", label: "Net Profit Reports" },
      { key: "reports.financial", label: "Financial Reports (Daily Closing)" },
      { key: "reports.customers", label: "Customer Reports" },
      { key: "reports.staff", label: "Staff Activity Reports" },
      { key: "reports.export", label: "Export Reports (PDF / CSV)" },
      { key: "reports.print", label: "Print Reports" },
    ],
  },
  {
    key: "data",
    label: "Data",
    items: [{ key: "data.export", label: "Export Data (CSV: products, sales, customers, expenses)" }],
  },
  {
    key: "notifications",
    label: "Notifications",
    items: [{ key: "notifications.push", label: "Receive Phone Notifications" }],
  },
  {
    key: "audit",
    label: "Audit Log",
    items: [{ key: "audit.view", label: "View Audit Log (sensitive: shows all staff activity)" }],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { key: "settings.shop", label: "Shop Settings" },
      { key: "settings.payment", label: "Payment Settings" },
      { key: "settings.invoice", label: "Invoice Settings" },
      { key: "settings.inventory", label: "Inventory Settings" },
      { key: "settings.system", label: "System Settings" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key)
);

const VALID = new Set(ALL_PERMISSION_KEYS);

export const DEFAULT_STAFF_PERMISSIONS = ["dashboard.view"];

/** Drops unknown keys so a tampered request can never store arbitrary permissions. */
export function sanitizePermissions(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return Array.from(new Set(keys.filter((k): k is string => typeof k === "string" && VALID.has(k))));
}

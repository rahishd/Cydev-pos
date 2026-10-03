export const AUDIT_MODULES = [
  "Authentication",
  "Users",
  "Products",
  "Inventory",
  "Sales",
  "Purchases",
  "Customers",
  "Suppliers",
  "Expenses",
  "Promo Codes",
  "Settings",
  "Backup",
] as const;

export const ACTION_GROUPS = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "payment", label: "Payment" },
  { value: "return", label: "Return / Exchange" },
  { value: "adjustment", label: "Adjustment" },
  { value: "export", label: "Export / Share" },
  { value: "other", label: "Other" },
] as const;

const GROUPS: Record<string, string[]> = {
  create: ["created"],
  update: ["updated", "activated", "deactivated", "password_reset", "permissions_changed", "settings_changed", "received", "cancelled", "status_changed", "account_unlocked", "price_changed"],
  delete: ["deleted"],
  login: ["login", "login_failed", "account_locked"],
  logout: ["logout"],
  payment: ["payment"],
  return: ["return", "exchange"],
  adjustment: ["adjustment"],
  export: ["export", "invoice_shared"],
};

export function actionsInGroup(group: string): string[] {
  return GROUPS[group] ?? [];
}

export function groupOf(action: string): string {
  for (const [g, list] of Object.entries(GROUPS)) if (list.includes(action)) return g;
  return "other";
}

export const AUDIT_ID = (n: number) => `AUD-${String(n).padStart(6, "0")}`;

/** Older entries were written before "module" existed, so derive it from the record type. */
export function moduleFromType(type: string): string {
  switch (type) {
    case "Session":
      return "Authentication";
    case "User":
      return "Users";
    case "Settings":
      return "Settings";
    case "Expense":
    case "ExpenseCategory":
      return "Expenses";
    case "Product":
    case "ProductVariant":
    case "Category":
    case "Brand":
      return "Products";
    case "StockMovement":
      return "Inventory";
    case "Sale":
    case "Invoice":
    case "SaleReturn":
      return "Sales";
    case "Purchase":
      return "Purchases";
    case "Customer":
    case "CustomerCredit":
      return "Customers";
    case "Supplier":
      return "Suppliers";
    case "PromoCode":
      return "Promo Codes";
    case "Backup":
      return "Backup";
    default:
      return type;
  }
}

const ACTION_WORDS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  activated: "Activated",
  deactivated: "Deactivated",
  login: "Login",
  login_failed: "Failed Login",
  logout: "Logout",
  account_locked: "Account Locked",
  account_unlocked: "Account Unlocked",
  password_reset: "Password Reset",
  permissions_changed: "Permissions Changed",
  settings_changed: "Settings Changed",
  payment: "Payment",
  return: "Return",
  exchange: "Exchange",
  adjustment: "Stock Adjustment",
  export: "Export",
  received: "Received",
  cancelled: "Cancelled",
  status_changed: "Status Changed",
  price_changed: "Price Changed",
  access_denied: "Access Denied",
  invoice_shared: "Invoice Shared",
};

export function actionLabel(action: string, title?: string | null, type?: string): string {
  if (title) return title;
  const word = ACTION_WORDS[action] ?? action.replace(/_/g, " ");
  const noun = type && type !== "Session" && type !== "Settings" ? ` ${type}` : "";
  return [
    "login",
    "login_failed",
    "logout",
    "account_locked",
    "permissions_changed",
    "settings_changed",
    "adjustment",
    "access_denied",
    "invoice_shared",
    "export",
    "payment",
    "return",
    "exchange",
    "password_reset",
    "price_changed",
  ].includes(action)
    ? word
    : `${word}${noun}`;
}

export type FieldType = "text" | "textarea" | "number" | "toggle" | "select" | "time" | "list";

export type SettingField = {
  key: string;
  label: string;
  type: FieldType;
  default: string | number | boolean | string[];
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  suffix?: string;
  /** true when the app already changes behaviour based on this setting. */
  applied?: boolean;
  /** Only shown (and editable) while this other toggle in the same section is on. */
  showIf?: string;
};

export type SettingsSectionId =
  | "business"
  | "invoice"
  | "sales"
  | "inventory"
  | "products"
  | "purchases"
  | "customers"
  | "suppliers"
  | "expenses"
  | "returns"
  | "payments"
  | "notifications"
  | "security"
  | "backup"
  | "system";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  /** Staff need this permission (or any settings.* the Owner grants for that area); the Owner always has access. */
  permission: string;
  custom?: "logo" | "expenseCategories" | "backup" | "push";
  fields: SettingField[];
};

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "ESEWA", label: "eSewa" },
  { value: "KHALTI", label: "Khalti" },
  { value: "FONEPAY", label: "Fonepay" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT", label: "Credit" },
];

const TERMS_OPTIONS = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "7", label: "7 days" },
  { value: "15", label: "15 days" },
  { value: "30", label: "30 days" },
  { value: "45", label: "45 days" },
];

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "business",
    label: "Business",
    description: "Shop details used on invoices, vouchers, reports and the app header.",
    permission: "settings.shop",
    custom: "logo",
    fields: [
      { key: "shopName", label: "Shop name", type: "text", default: "Labash Fashion", applied: true },
      { key: "addressLine1", label: "Address line 1", type: "text", default: "Manigram, Sattar Line, Tilottama-5", applied: true },
      { key: "addressLine2", label: "Address line 2", type: "text", default: "Tilottama Municipality", applied: true },
      { key: "phone", label: "Contact number", type: "text", default: "97609450", applied: true },
      { key: "email", label: "Email (optional)", type: "text", default: "", applied: true },
      { key: "panVat", label: "PAN / VAT number", type: "text", default: "", applied: true },
      { key: "registrationNo", label: "Business registration number", type: "text", default: "", applied: true },
      {
        key: "currency",
        label: "Currency",
        type: "select",
        default: "NPR",
        options: [{ value: "NPR", label: "Nepalese Rupee (NPR)" }],
        help: "The whole system is built around NPR.",
      },
      {
        key: "timezone",
        label: "Time zone",
        type: "select",
        default: "Asia/Kathmandu",
        options: [{ value: "Asia/Kathmandu", label: "Nepal (UTC+5:45)" }],
      },
      { key: "openingTime", label: "Opening time", type: "time", default: "09:00" },
      { key: "closingTime", label: "Closing time", type: "time", default: "20:00" },
    ],
  },
  {
    id: "invoice",
    label: "Invoice",
    description: "How invoices are numbered and what they show.",
    permission: "settings.invoice",
    fields: [
      { key: "prefix", label: "Invoice prefix", type: "text", default: "INV-", applied: true, help: "Example: INV-" },
      { key: "startingNumber", label: "Next invoice number", type: "number", default: 1, min: 1, applied: true, help: "The next invoice uses this number, or the one after your latest invoice, whichever is higher." },
      { key: "numberDigits", label: "Number length", type: "number", default: 6, min: 1, max: 10, applied: true, help: "6 gives INV-000125." },
      { key: "showLogo", label: "Show shop logo on invoice", type: "toggle", default: true, applied: true },
      { key: "showPanVat", label: "Show PAN / VAT on invoice", type: "toggle", default: true, applied: true },
      { key: "footer", label: "Invoice footer", type: "text", default: "Thank you for shopping with us!", applied: true },
      { key: "returnPolicy", label: "Return policy text", type: "textarea", default: "", applied: true },
      { key: "terms", label: "Terms & conditions", type: "textarea", default: "", applied: true },
      {
        key: "paperSize",
        label: "Invoice paper size",
        type: "select",
        default: "A4",
        options: [{ value: "A4", label: "A4" }],
        help: "Thermal receipt printing isn't available yet; A4 PDF is used.",
      },
      { key: "enablePdf", label: "Enable PDF invoice", type: "toggle", default: true, applied: true },
      { key: "enableReprint", label: "Enable invoice reprint / re-share", type: "toggle", default: true, applied: true, help: "Lets staff download or share an invoice again from Sales History." },
    ],
  },
  {
    id: "sales",
    label: "Sales & POS",
    description: "Rules applied when staff make sales.",
    permission: "settings.payment",
    fields: [
      { key: "defaultPaymentMethod", label: "Default payment method", type: "select", default: "CASH", options: PAYMENT_OPTIONS, applied: true },
      { key: "allowDiscounts", label: "Allow discounts", type: "toggle", default: true, applied: true },
      { key: "maxStaffDiscountPercent", label: "Maximum staff discount", type: "number", default: 10, min: 0, max: 100, suffix: "%", applied: true, showIf: "allowDiscounts", help: "Above this, only the Owner can complete the sale. The Owner is never limited." },
      { key: "allowOutOfStockSales", label: "Show out-of-stock products in POS", type: "toggle", default: false, applied: true, help: "A sale beyond available stock still needs 'Allow negative inventory' in Inventory settings." },
      { key: "requireCustomerForCredit", label: "Require customer for credit sales", type: "toggle", default: true, applied: true },
      { key: "requireApprovalCancelSales", label: "Require approval for cancelled sales", type: "toggle", default: false },
      { key: "requireApprovalLargeDiscount", label: "Require approval for large discounts", type: "toggle", default: false },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock rules and alerts.",
    permission: "settings.inventory",
    fields: [
      { key: "defaultMinStock", label: "Default minimum stock level", type: "number", default: 3, min: 0, applied: true, help: "Pre-filled for new products and variants." },
      { key: "lowStockThreshold", label: "Low-stock alert at or below", type: "number", default: 3, min: 0, suffix: "units", applied: true, help: "Used for variants that have no minimum of their own." },
      { key: "allowNegativeStock", label: "Allow negative inventory", type: "toggle", default: false, applied: true },
      { key: "requireAdjustmentReason", label: "Require a reason for stock adjustments", type: "toggle", default: true, applied: true },
      { key: "requireOwnerApprovalAdjust", label: "Require Owner approval for adjustments", type: "toggle", default: false },
      { key: "enableStockCount", label: "Enable stock count", type: "toggle", default: true },
      { key: "allowDamaged", label: "Allow damaged stock entries", type: "toggle", default: true },
      { key: "allowLost", label: "Allow lost stock entries", type: "toggle", default: true },
      {
        key: "valuationMethod",
        label: "Stock valuation method",
        type: "select",
        default: "LAST_COST",
        options: [
          { value: "LAST_COST", label: "Last purchase cost" },
          { value: "AVERAGE", label: "Average cost" },
          { value: "FIFO", label: "FIFO" },
        ],
        help: "Profit already uses the actual cost saved on each sale.",
      },
      {
        key: "unit",
        label: "Unit of measurement",
        type: "select",
        default: "pcs",
        options: [
          { value: "pcs", label: "Pieces" },
          { value: "pair", label: "Pairs" },
          { value: "set", label: "Sets" },
        ],
      },
    ],
  },
  {
    id: "products",
    label: "Products",
    description: "How products and variants behave.",
    permission: "settings.inventory",
    fields: [
      { key: "autoGenerateSku", label: "Auto-generate SKU", type: "toggle", default: true },
      { key: "skuPrefix", label: "SKU prefix", type: "text", default: "", showIf: "autoGenerateSku" },
      { key: "enableVariants", label: "Enable product variants", type: "toggle", default: true },
      { key: "sizes", label: "Sizes", type: "list", default: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"], help: "One per line." },
      { key: "colors", label: "Colors", type: "list", default: ["Black", "White", "Brown", "Red", "Blue"], help: "One per line." },
      { key: "requireImage", label: "Require a product image", type: "toggle", default: false },
      { key: "defaultMarkupPercent", label: "Default selling price markup", type: "number", default: 0, min: 0, suffix: "%", help: "Suggested markup over purchase price." },
    ],
  },
  {
    id: "purchases",
    label: "Purchases",
    description: "Purchase order numbering and rules.",
    permission: "settings.system",
    fields: [
      { key: "prefix", label: "Purchase prefix", type: "text", default: "PUR-", applied: true },
      { key: "startingNumber", label: "Next purchase number", type: "number", default: 1, min: 1, applied: true },
      { key: "numberDigits", label: "Number length", type: "number", default: 6, min: 1, max: 10, applied: true },
      { key: "defaultPaymentTerms", label: "Default payment terms", type: "select", default: "IMMEDIATE", options: TERMS_OPTIONS },
      { key: "allowPartialReceiving", label: "Allow partial receiving", type: "toggle", default: true },
      { key: "allowPartialPayment", label: "Allow partial payment", type: "toggle", default: true },
      { key: "requireApproval", label: "Require purchase approval", type: "toggle", default: false },
      {
        key: "defaultStatus",
        label: "Default purchase status",
        type: "select",
        default: "DRAFT",
        options: [
          { value: "DRAFT", label: "Draft" },
          { value: "ORDERED", label: "Ordered" },
        ],
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    description: "Customer and credit rules.",
    permission: "settings.system",
    fields: [
      { key: "allowGuest", label: "Allow guest (walk-in) customers", type: "toggle", default: true },
      { key: "requirePhone", label: "Require phone number for customers", type: "toggle", default: false, applied: true },
      { key: "creditEnabled", label: "Customer credit enabled", type: "toggle", default: true, applied: true },
      { key: "maxCreditAmount", label: "Maximum credit per customer", type: "number", default: 0, min: 0, suffix: "NPR", applied: true, showIf: "creditEnabled", help: "0 means no limit." },
      { key: "creditDueDays", label: "Default credit due period", type: "number", default: 30, min: 1, suffix: "days", applied: true, showIf: "creditEnabled" },
      { key: "idPrefix", label: "Customer ID prefix", type: "text", default: "C-" },
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Supplier defaults.",
    permission: "settings.system",
    fields: [
      { key: "idPrefix", label: "Supplier ID prefix", type: "text", default: "S-" },
      { key: "defaultPaymentTerms", label: "Default payment terms", type: "select", default: "IMMEDIATE", options: TERMS_OPTIONS },
      { key: "creditEnabled", label: "Supplier credit enabled", type: "toggle", default: true },
      { key: "requirePhone", label: "Require supplier phone number", type: "toggle", default: false },
      { key: "requirePanVat", label: "Require supplier PAN / VAT", type: "toggle", default: false },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Expense categories. Add, rename or deactivate them here.",
    permission: "settings.system",
    custom: "expenseCategories",
    fields: [],
  },
  {
    id: "returns",
    label: "Returns & Exchange",
    description: "Rules for returned and exchanged items.",
    permission: "settings.system",
    fields: [
      { key: "returnsEnabled", label: "Returns allowed", type: "toggle", default: true, applied: true },
      { key: "exchangeEnabled", label: "Exchange allowed", type: "toggle", default: true, applied: true },
      { key: "returnWindowDays", label: "Return / exchange period", type: "number", default: 7, min: 0, suffix: "days", applied: true, help: "0 means no time limit. The Owner can always override." },
      {
        key: "refundMethod",
        label: "Refund method",
        type: "select",
        default: "ORIGINAL",
        options: [
          { value: "ORIGINAL", label: "Original payment method" },
          { value: "CASH", label: "Cash" },
          { value: "STORE_CREDIT", label: "Store credit" },
        ],
      },
      { key: "storeCreditEnabled", label: "Store credit enabled", type: "toggle", default: true },
      { key: "exchangeWithoutReceipt", label: "Exchange without receipt", type: "toggle", default: false },
      { key: "requireOwnerApproval", label: "Require Owner approval", type: "toggle", default: false },
      { key: "autoRestock", label: "Restock returned products automatically", type: "toggle", default: true, applied: true },
      {
        key: "damagedHandling",
        label: "Damaged return handling",
        type: "select",
        default: "WRITE_OFF",
        options: [
          { value: "WRITE_OFF", label: "Write off" },
          { value: "RESTOCK_DAMAGED", label: "Restock as damaged" },
          { value: "SUPPLIER_RETURN", label: "Return to supplier" },
        ],
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Choose which payment methods staff can use at the counter.",
    permission: "settings.payment",
    fields: [
      { key: "cash", label: "Cash", type: "toggle", default: true, applied: true },
      { key: "esewa", label: "eSewa", type: "toggle", default: true, applied: true },
      { key: "khalti", label: "Khalti", type: "toggle", default: true, applied: true },
      { key: "fonepay", label: "Fonepay", type: "toggle", default: true, applied: true },
      { key: "card", label: "Card", type: "toggle", default: true, applied: true },
      { key: "bankTransfer", label: "Bank Transfer", type: "toggle", default: true, applied: true },
      { key: "credit", label: "Credit", type: "toggle", default: false, applied: true },
      {
        key: "demoQr",
        label: "Online QR payment (demo)",
        type: "toggle",
        default: true,
        applied: true,
        help: "When on, the payment method list shows just Cash and Online (QR); the cashier then picks Khalti, eSewa or Fonepay on the invoice. The eSewa, Khalti, Fonepay, Card and Bank Transfer switches above only matter when this is off. SIMULATION ONLY: no money moves and nothing is checked with eSewa or Khalti, so turn this off before real use.",
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Phone alerts go to the Owner's phone even when it is locked. Turn them on for each phone below. SMS, WhatsApp and email delivery aren't connected yet, so the alert switches further down are saved for later.",
    permission: "settings.system",
    custom: "push",
    fields: [
      { key: "pushSales", label: "Phone alert: every new sale", type: "toggle", default: true, applied: true },
      { key: "pushPayments", label: "Phone alert: payments received", type: "toggle", default: true, applied: true },
      { key: "pushReturns", label: "Phone alert: returns and exchanges", type: "toggle", default: true, applied: true },
      { key: "pushStock", label: "Phone alert: stock and product changes", type: "toggle", default: true, applied: true, help: "Stock added or adjusted, damaged or lost stock, price changes, products added or removed." },
      { key: "pushSecurity", label: "Phone alert: failed sign-ins and locked accounts", type: "toggle", default: false, applied: true },
      { key: "lowStock", label: "Low-stock notification", type: "toggle", default: true },
      { key: "outOfStock", label: "Out-of-stock notification", type: "toggle", default: true },
      { key: "customerCreditDue", label: "Customer credit due", type: "toggle", default: true },
      { key: "supplierPaymentDue", label: "Supplier payment due", type: "toggle", default: true },
      { key: "failedLogin", label: "Failed login notification", type: "toggle", default: false },
      { key: "largeDiscount", label: "Large discount notification", type: "toggle", default: false },
      { key: "stockAdjustment", label: "Stock adjustment notification", type: "toggle", default: false },
    ],
  },
  {
    id: "security",
    label: "Security",
    description: "System-wide sign-in rules. Staff accounts and permissions are managed under Users.",
    permission: "settings.system",
    fields: [
      { key: "maxLoginAttempts", label: "Maximum login attempts", type: "number", default: 5, min: 0, max: 20, applied: true, help: "Wrong passwords in a row before the account is locked. 0 turns locking off." },
      { key: "lockMinutes", label: "Account lock duration", type: "number", default: 15, min: 1, max: 1440, suffix: "minutes", applied: true },
      { key: "passwordMinLength", label: "Password minimum length", type: "number", default: 6, min: 4, max: 32, applied: true, help: "Applies when you create or reset a password." },
      { key: "passwordComplexity", label: "Require upper, lower case and a number", type: "toggle", default: false, applied: true },
      { key: "requireChangeAfterReset", label: "Require password change after reset", type: "toggle", default: false },
      { key: "sessionTimeoutMinutes", label: "Session timeout", type: "number", default: 480, min: 5, suffix: "minutes", help: "Staff change-password and auto sign-out aren't built yet." },
      { key: "auditRetentionDays", label: "Audit log retention", type: "number", default: 365, min: 30, suffix: "days" },
    ],
  },
  {
    id: "backup",
    label: "Backup & Data",
    description: "Download your data. Restoring is done through your database provider.",
    permission: "data.export",
    custom: "backup",
    fields: [
      {
        key: "schedule",
        label: "Backup reminder",
        type: "select",
        default: "WEEKLY",
        options: [
          { value: "OFF", label: "Off" },
          { value: "DAILY", label: "Daily" },
          { value: "WEEKLY", label: "Weekly" },
          { value: "MONTHLY", label: "Monthly" },
        ],
        help: "Shows a reminder to download a backup. Automatic scheduled backups aren't built yet.",
      },
    ],
  },
  {
    id: "system",
    label: "System Preferences",
    description: "Everyday display preferences.",
    permission: "settings.system",
    fields: [
      {
        key: "defaultDashboardPeriod",
        label: "Default dashboard period",
        type: "select",
        default: "today",
        options: [
          { value: "today", label: "Today" },
          { value: "yesterday", label: "Yesterday" },
          { value: "thisWeek", label: "This week" },
        ],
        applied: true,
      },
      { key: "theme", label: "Theme", type: "select", default: "light", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] },
      { key: "language", label: "Language", type: "select", default: "en", options: [{ value: "en", label: "English" }, { value: "ne", label: "Nepali" }] },
      { key: "dateFormat", label: "Date format", type: "select", default: "MDY", options: [{ value: "MDY", label: "Oct 3, 2026" }, { value: "DMY", label: "03/10/2026" }, { value: "YMD", label: "2026-10-03" }] },
      { key: "timeFormat", label: "Time format", type: "select", default: "12h", options: [{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }] },
      { key: "itemsPerPage", label: "Items per page", type: "number", default: 25, min: 10, max: 200 },
    ],
  },
];

export type SettingValue = string | number | boolean | string[];
export type SettingsValues = Record<SettingsSectionId, Record<string, SettingValue>> & {
  business: Record<string, SettingValue> & { logo?: string };
};

export function defaultsFor(section: SettingsSection): Record<string, SettingValue> {
  return Object.fromEntries(section.fields.map((f) => [f.key, f.default]));
}

export function buildSettings(stored: unknown): SettingsValues {
  const data = (stored && typeof stored === "object" ? stored : {}) as Record<string, Record<string, SettingValue>>;
  const out: Record<string, Record<string, SettingValue>> = {};
  for (const section of SETTINGS_SECTIONS) {
    out[section.id] = { ...defaultsFor(section), ...(data[section.id] ?? {}) };
  }
  if (typeof data.business?.logo === "string") out.business.logo = data.business.logo;
  return out as SettingsValues;
}

/** Validates and normalises incoming values for one section; throws on invalid input. */
export function cleanSectionValues(
  section: SettingsSection,
  input: Record<string, unknown>
): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const f of section.fields) {
    const raw = input[f.key];
    if (raw === undefined) {
      out[f.key] = f.default;
      continue;
    }
    switch (f.type) {
      case "toggle":
        out[f.key] = Boolean(raw);
        break;
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(`${f.label} must be a number`);
        if (f.min !== undefined && n < f.min) throw new Error(`${f.label} must be at least ${f.min}`);
        if (f.max !== undefined && n > f.max) throw new Error(`${f.label} must be at most ${f.max}`);
        out[f.key] = Math.round(n * 100) / 100;
        break;
      }
      case "select": {
        const v = String(raw);
        if (!f.options?.some((o) => o.value === v)) throw new Error(`${f.label} has an invalid choice`);
        out[f.key] = v;
        break;
      }
      case "time": {
        const v = String(raw);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error(`${f.label} must be a valid time`);
        out[f.key] = v;
        break;
      }
      case "list": {
        const arr = Array.isArray(raw) ? raw : String(raw).split("\n");
        out[f.key] = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 200);
        break;
      }
      default:
        out[f.key] = String(raw).trim().slice(0, f.type === "textarea" ? 2000 : 200);
    }
  }
  return out;
}

/** Applies an invoice/purchase-style number format: prefix + zero-padded number. */
export function formatNumber(prefix: string, n: number, digits: number): string {
  return `${prefix}${String(n).padStart(digits, "0")}`;
}

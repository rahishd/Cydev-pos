export type ColFmt = "text" | "money" | "int" | "pct" | "date" | "datetime";

export type Col = { key: string; label: string; fmt?: ColFmt };
export type Row = Record<string, string | number | null>;

export type Card = {
  label: string;
  value: number;
  fmt: "money" | "int" | "pct";
  hint?: string;
  tone?: "good" | "bad";
};

export type ReportTable = {
  title?: string;
  cols: Col[];
  rows: Row[];
  totals?: Row;
};

export type ChartSpec = {
  kind: "line" | "bar" | "donut" | "hbar";
  title: string;
  /** Each point has a `name` plus one number per series key. */
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string }>;
  money?: boolean;
};

export type ReportResult = {
  key: string;
  title: string;
  periodLabel: string;
  notes: string[];
  cards: Card[];
  charts: ChartSpec[];
  tables: ReportTable[];
  /** Daily closing: the cash the till should hold, before the Owner types in opening and counted cash. */
  cashRecon?: { lines: Array<{ label: string; value: number }> };
};

/** Dates are Nepal calendar days written YYYY-MM-DD, both ends included. */
export type Filters = {
  from: string;
  to: string;
  categoryId?: string;
  brandId?: string;
  staffId?: string;
  customerId?: string;
  supplierId?: string;
  method?: string;
};

export type FilterKey = "category" | "brand" | "staff" | "customer" | "supplier" | "method";

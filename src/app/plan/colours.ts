// src/app/plan/colours.ts
import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan";
import { theme } from "@/lib/theme";

export const WRAPPER_COLOURS: Record<Wrapper, string> = {
  PENSION: "#1E5BC6",
  ISA: "#1F8A4C",
  GIA: "#7C3AED",
  CASH: "#0EA5A4",
  PROPERTY: "#D97706",
  DB_PENSION: "#475569",
  OTHER: "#94A3B8",
};

// Human-readable wrapper labels for chart legends / tooltips (the raw enum keys
// read as shouty all-caps). True acronyms (ISA, GIA) stay uppercase.
export const WRAPPER_LABELS: Record<Wrapper, string> = {
  PENSION: "Pension",
  ISA: "ISA",
  GIA: "GIA",
  CASH: "Cash",
  PROPERTY: "Property",
  DB_PENSION: "DB pension",
  OTHER: "Other",
};

export const DEBT_COLOUR = theme.colors.negative;
// Was #0F1116 — a near-black line, which on a dark page is invisible.
export const NET_WORTH_COLOUR = theme.colors.ink;

// Cash-flow chart — income sources (positive) and outflows (negative).
// Drawdowns and contributions are drawn per asset (see ASSET_FLOW_PALETTE), so
// they are not keyed here.
export const INCOME_COLOURS: Record<IncomeKind, string> = {
  SALARY: "#1F8A4C",
  SELF_EMPLOYMENT: "#2BA35E",
  STATE_PENSION: "#1E5BC6",
  DB_PENSION: "#475569",
  RENTAL: "#0EA5A4",
  OTHER: "#94A3B8",
};

// Outflows keyed by ExpenseCategory + tax / loan repayments.
export const OUTFLOW_COLOURS: Record<
  ExpenseCategory | "TAX" | "REPAYMENT",
  string
> = {
  FIXED: "#B33B3B",
  VARIABLE: "#D97706",
  DISCRETIONARY: "#E0A458",
  TAX: "#6B7280",
  REPAYMENT: "#92400E",
};

// Per-asset drawdown / contribution segments on the cash-flow chart, assigned by
// asset order. Distinct hues, kept clear of the income greens/blues and outflow
// reds/oranges so a withdrawal isn't mistaken for salary or an expense. An
// asset's withdrawal and contribution share its colour (opposite sides of zero).
export const ASSET_FLOW_PALETTE = [
  "#7C3AED",
  "#0EA5A4",
  "#DB2777",
  "#2563EB",
  "#CA8A04",
  "#9333EA",
  "#0891B2",
  "#E11D48",
];

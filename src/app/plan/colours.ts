// src/app/plan/colours.ts
import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan";

export const WRAPPER_COLOURS: Record<Wrapper, string> = {
  PENSION: "#1E5BC6",
  ISA: "#1F8A4C",
  GIA: "#7C3AED",
  CASH: "#0EA5A4",
  PROPERTY: "#D97706",
  DB_PENSION: "#475569",
  OTHER: "#94A3B8",
};

export const DEBT_COLOUR = "#B33B3B";
export const NET_WORTH_COLOUR = "#0F1116";

// Cash-flow chart — income sources (positive) and outflows (negative).
// Income keyed by IncomeKind + the synthetic WITHDRAWAL (drawdown from pots).
export const INCOME_COLOURS: Record<IncomeKind | "WITHDRAWAL", string> = {
  SALARY: "#1F8A4C",
  SELF_EMPLOYMENT: "#2BA35E",
  STATE_PENSION: "#1E5BC6",
  DB_PENSION: "#475569",
  RENTAL: "#0EA5A4",
  OTHER: "#94A3B8",
  WITHDRAWAL: "#7C3AED",
};

// Outflows keyed by ExpenseCategory + tax / loan repayments / contributions.
export const OUTFLOW_COLOURS: Record<
  ExpenseCategory | "TAX" | "REPAYMENT" | "CONTRIBUTION",
  string
> = {
  FIXED: "#B33B3B",
  VARIABLE: "#D97706",
  DISCRETIONARY: "#E0A458",
  TAX: "#6B7280",
  REPAYMENT: "#92400E",
  CONTRIBUTION: "#2563EB",
};

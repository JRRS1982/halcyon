// src/lib/plan/types.ts

import type { Regime } from "@/lib/tax/types";

export type Wrapper =
  | "PENSION"
  | "ISA"
  | "GIA"
  | "CASH"
  | "PROPERTY"
  | "DB_PENSION"
  | "OTHER";

export const WRAPPERS: Wrapper[] = [
  "PENSION",
  "ISA",
  "GIA",
  "CASH",
  "PROPERTY",
  "DB_PENSION",
  "OTHER",
];

export type IncomeKind =
  | "SALARY"
  | "SELF_EMPLOYMENT"
  | "STATE_PENSION"
  | "DB_PENSION"
  | "RENTAL"
  | "OTHER";

export type ExpenseCategory = "FIXED" | "VARIABLE" | "DISCRETIONARY";

export type Growth =
  | { kind: "INFLATION" }
  | { kind: "FIXED"; pct: number }
  | { kind: "NONE" };

export interface AssetInput {
  id: string;
  label: string;
  wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct?: number; // undefined ⇒ PlanInput.defaultReturnPct
  feePct?: number; // annual charge subtracted from the effective return; default 0
  annualContribution?: number; // regular paying-in, inflation-grown; default 0
  contributionEndAge?: number; // default = PlanInput.retirementAge
  minAccessAge?: number; // earliest drawdown age; PENSION defaults to 57 when undefined
  drawdownPriority: number; // ascending = drawn first (CASH buffer first)
}

export interface LiabilityInput {
  id: string;
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
  startAge?: number; // debt drawn at this age; undefined = from plan start
  endAge?: number;
  linkedAssetId?: string;
  interestOnly?: boolean;
}

export interface IncomeInput {
  id: string;
  label: string;
  kind: IncomeKind;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  growth: Growth;
  taxable: boolean;
}

export interface ExpenseInput {
  id: string;
  label: string;
  category?: ExpenseCategory;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  inflationLinked: boolean;
  liabilityId?: string; // repayment of this liability; excluded from category totals
}

export interface EventInput {
  id: string;
  label: string;
  age: number;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
  kind?: "MANUAL" | "PROPERTY_SALE"; // default MANUAL
  assetId?: string; // the property sold, when kind === "PROPERTY_SALE"
}

export interface PlanInput {
  currentAge: number;
  startYear: number; // calendar year of currentAge
  retirementAge: number;
  planToAge: number; // horizon the projection runs to (chart extent)
  expectedDeathAge?: number; // horizon the verdict is judged to; falls back to planToAge
  inflationPct: number;
  defaultReturnPct: number;
  returnSpreadPct?: number; // ± shift applied to every asset's return for the low/high passes; default 0
  taxRegime: Regime; // which set of bands the year's income is walked through
  // Whether thresholds rise with inflation beyond the last known tax year. Read
  // by taxContextFor, which scales the personal allowance and every band
  // threshold by (1 + inflationPct/100) ** years-since-that-year-ended when
  // true, and leaves them frozen when false.
  thresholdsInflationLinked: boolean;
  statePension?: { startAge: number; annualAmount: number };
  assets: AssetInput[];
  liabilities: LiabilityInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  events: EventInput[];
}

export interface AssetBalance {
  id: string;
  label: string;
  wrapper: Wrapper;
  value: number; // closing balance
  contributed: number; // paid in this year
  withdrawn: number; // drawn out this year (gross)
}

export interface LiabilityBalance {
  id: string;
  label: string;
  value: number;
  interest: number; // interest paid this year
  principal: number; // principal repaid this year
}

export interface YearProjection {
  age: number;
  year: number;
  grossIncome: number;
  incomeByKind: Record<string, number>;
  tax: number;
  netIncome: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  liabilityRepayments: number;
  surplus: number;
  contributions: number;
  withdrawals: number;
  assets: AssetBalance[];
  liabilities: LiabilityBalance[];
  liabilitiesTotal: number;
  netWorth: number;
  shortfall: boolean;
}

// Net worth at the two milestones that matter, in today's money. Either is
// null when the projection never reaches that age.
export type Milestone = { age: number; value: number } | null;

export interface Verdict {
  feasible: boolean;
  firstShortfallAge: number | null;
  netWorthAtRetirement: Milestone;
  netWorthAtDeath: Milestone;
}

export interface PlanProjection {
  years: YearProjection[];
  verdict: Verdict;
}

export interface BandedVerdict extends Verdict {
  // [min, max] across the three passes. firstShortfallAgeRange is null only when
  // no pass ever shorts; a net-worth range is null when its milestone is.
  // Both net-worth ranges are in today's money (assembled post-deflation).
  firstShortfallAgeRange: [number, number] | null;
  netWorthAtRetirementRange: [number, number] | null;
  netWorthAtDeathRange: [number, number] | null;
}

export interface BandedProjection {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  verdict: BandedVerdict;
}

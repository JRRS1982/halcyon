// src/lib/plan/types.ts

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
  taxRatePct: number; // v1 blended tax rate
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

export interface Verdict {
  feasible: boolean;
  firstShortfallAge: number | null;
  peakNetWorth: { age: number; value: number };
}

export interface PlanProjection {
  years: YearProjection[];
  verdict: Verdict;
}

export interface BandedVerdict extends Verdict {
  // [min, max] across the three passes. firstShortfallAgeRange is null only when
  // no pass ever shorts. peakNetWorthRange is in today's money (assembled post-deflation).
  firstShortfallAgeRange: [number, number] | null;
  peakNetWorthRange: [number, number];
}

export interface BandedProjection {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  verdict: BandedVerdict;
}

// src/app/plan/serialized.ts
import type { ExpenseSection, IncomeKind, Wrapper } from "@/lib/plan";
import type { Regime } from "@/lib/tax/types";

export type SerializedPlanAssumptions = {
  id: string;
  dateOfBirth: string; // YYYY-MM-DD
  retirementAge: number;
  planToAge: number;
  inflationPct: number;
  defaultReturnPct: number;
  returnSpreadPct: number;
  taxRegime: Regime;
  thresholdsInflationLinked: boolean;
  statePensionAge: number | null;
  statePensionAnnual: number | null;
  expectedDeathAge: number | null;
};

export type SerializedPlanAsset = {
  id: string;
  label: string;
  wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct: number | null;
  feePct: number;
  monthlyContribution: number;
  contributionEndAge: number | null;
  minAccessAge: number | null;
  drawdownPriority: number;
};

export type SerializedPlanLiability = {
  id: string;
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
  startAge: number | null;
  endAge: number | null;
  linkedAssetId: string | null;
  interestOnly: boolean;
};

export type GrowthKind = "INFLATION" | "FIXED" | "NONE";
export type EventDirection = "INFLOW" | "OUTFLOW";
export type EventKind = "MANUAL" | "PROPERTY_SALE";

export type SerializedPlanIncome = {
  id: string;
  label: string;
  kind: IncomeKind;
  annualAmount: number;
  startAge: number | null;
  endAge: number | null;
  growthKind: GrowthKind;
  growthPct: number | null;
  taxable: boolean;
};

export type SerializedPlanExpense = {
  id: string;
  label: string;
  section: ExpenseSection | null;
  annualAmount: number;
  startAge: number | null;
  endAge: number | null;
  inflationLinked: boolean;
  liabilityId: string | null;
};

export type SerializedPlanEvent = {
  id: string;
  label: string;
  age: number;
  direction: EventDirection;
  amount: number;
  kind: EventKind;
  assetId: string | null;
};

export type SerializedPlan = {
  assumptions: SerializedPlanAssumptions;
  assets: SerializedPlanAsset[];
  liabilities: SerializedPlanLiability[];
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  events: SerializedPlanEvent[];
};

// src/app/plan/serialized.ts
import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan";

export type SerializedPlanAssumptions = {
  id: string;
  dateOfBirth: string; // YYYY-MM-DD
  retirementAge: number;
  planToAge: number;
  inflationPct: number;
  defaultReturnPct: number;
  blendedTaxRatePct: number;
  statePensionAge: number | null;
  statePensionAnnual: number | null;
};

export type SerializedPlanAsset = {
  id: string;
  label: string;
  wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct: number | null;
  annualContribution: number;
  contributionEndAge: number | null;
  drawdownPriority: number;
};

export type SerializedPlanLiability = {
  id: string;
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
  endAge: number | null;
};

export type GrowthKind = "INFLATION" | "FIXED" | "NONE";
export type EventDirection = "INFLOW" | "OUTFLOW";

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
  category: ExpenseCategory;
  annualAmount: number;
  startAge: number | null;
  endAge: number | null;
  inflationLinked: boolean;
};

export type SerializedPlanEvent = {
  id: string;
  label: string;
  age: number;
  direction: EventDirection;
  amount: number;
};

export type SerializedPlan = {
  assumptions: SerializedPlanAssumptions;
  assets: SerializedPlanAsset[];
  liabilities: SerializedPlanLiability[];
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  events: SerializedPlanEvent[];
};

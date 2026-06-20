// src/app/plan/serialized.ts
import type { Wrapper } from "@/lib/plan";

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

export type SerializedPlan = {
  assumptions: SerializedPlanAssumptions;
  assets: SerializedPlanAsset[];
  liabilities: SerializedPlanLiability[];
};

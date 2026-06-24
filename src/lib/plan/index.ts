// src/lib/plan/index.ts
export { project, projectWithBand, earliestSustainableRetirementAge } from "./project";
export { incomeTax, grossUp, isTaxableOnWithdrawal } from "./tax";
export { WRAPPERS } from "./types";
export type {
  AssetBalance,
  AssetInput,
  BandedProjection,
  BandedVerdict,
  EventInput,
  ExpenseCategory,
  ExpenseInput,
  Growth,
  IncomeInput,
  IncomeKind,
  LiabilityBalance,
  LiabilityInput,
  PlanInput,
  PlanProjection,
  Verdict,
  Wrapper,
  YearProjection,
} from "./types";

// src/lib/plan/index.ts
export { project, earliestSustainableRetirementAge } from "./project";
export { incomeTax, grossUp, isTaxableOnWithdrawal } from "./tax";
export { WRAPPERS } from "./types";
export type {
  AssetBalance,
  AssetInput,
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

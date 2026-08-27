// src/lib/plan/index.ts
export { project, projectWithBand } from "./project";
export { isTaxableOnWithdrawal } from "./tax";
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
  Milestone,
  PlanInput,
  PlanProjection,
  Verdict,
  Wrapper,
  YearProjection,
} from "./types";
export { WRAPPERS } from "./types";

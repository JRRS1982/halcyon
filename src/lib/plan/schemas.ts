import { z } from "zod";

const WRAPPER = z.enum([
  "PENSION",
  "ISA",
  "GIA",
  "CASH",
  "PROPERTY",
  "DB_PENSION",
  "OTHER",
]);

export const updatePlanAssumptionsSchema = z.object({
  planId: z.string().uuid(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(90),
  planToAge: z.number().int().min(50).max(120),
  inflationPct: z.number().min(0).max(20),
  defaultReturnPct: z.number().min(-20).max(30),
  blendedTaxRatePct: z.number().min(0).max(60),
  statePensionAge: z.number().int().min(50).max(80).nullable(),
  statePensionAnnual: z.number().min(0).nullable(),
});

export const updatePlanAssetSchema = z.object({
  assetId: z.string().uuid(),
  label: z.string().min(1),
  wrapper: WRAPPER,
  openingValue: z.number().min(0),
  expectedReturnPct: z.number().min(-20).max(30).nullable(),
  annualContribution: z.number().min(0),
  drawdownPriority: z.number().int().min(0),
});

export const updatePlanLiabilitySchema = z.object({
  liabilityId: z.string().uuid(),
  label: z.string().min(1),
  openingBalance: z.number().min(0),
  interestPct: z.number().min(-20).max(30),
  monthlyRepayment: z.number().min(0),
  endAge: z.number().int().min(40).max(120).nullable(),
});

export type UpdatePlanAssumptionsInput = z.infer<
  typeof updatePlanAssumptionsSchema
>;
export type UpdatePlanAssetInput = z.infer<typeof updatePlanAssetSchema>;
export type UpdatePlanLiabilityInput = z.infer<
  typeof updatePlanLiabilitySchema
>;

const INCOME_KIND = z.enum([
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
]);
const GROWTH_KIND = z.enum(["INFLATION", "FIXED", "NONE"]);
const EXPENSE_CATEGORY = z.enum(["FIXED", "VARIABLE", "DISCRETIONARY"]);
const EVENT_DIRECTION = z.enum(["INFLOW", "OUTFLOW"]);

export const updatePlanIncomeSchema = z.object({
  incomeId: z.string().uuid(),
  label: z.string().min(1),
  kind: INCOME_KIND,
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120).nullable(),
  endAge: z.number().int().min(0).max(120).nullable(),
  growthKind: GROWTH_KIND,
  growthPct: z.number().min(-20).max(30).nullable(),
  taxable: z.boolean(),
});

export const updatePlanExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  label: z.string().min(1),
  category: EXPENSE_CATEGORY,
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120).nullable(),
  endAge: z.number().int().min(0).max(120).nullable(),
  inflationLinked: z.boolean(),
});

export const updatePlanEventSchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().min(1),
  age: z.number().int().min(0).max(120),
  direction: EVENT_DIRECTION,
  amount: z.number().min(0),
});

export const deleteRowSchema = z.object({ id: z.string().uuid() });

export type UpdatePlanIncomeInput = z.infer<typeof updatePlanIncomeSchema>;
export type UpdatePlanExpenseInput = z.infer<typeof updatePlanExpenseSchema>;
export type UpdatePlanEventInput = z.infer<typeof updatePlanEventSchema>;

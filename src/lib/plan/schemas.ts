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
  returnSpreadPct: z.number().min(0).max(10),
  taxRegime: z.enum(["RUK", "SCOTLAND"]),
  thresholdsInflationLinked: z.boolean(),
  statePensionAge: z.number().int().min(50).max(80).nullable(),
  statePensionAnnual: z.number().min(0).nullable(),
  expectedDeathAge: z.number().int().min(1).max(120).nullable(),
});

export const updatePlanAssetSchema = z.object({
  assetId: z.string().uuid(),
  label: z.string().min(1),
  wrapper: WRAPPER,
  openingValue: z.number().min(0),
  expectedReturnPct: z.number().min(-20).max(30).nullable(),
  feePct: z.number().min(0).max(5),
  monthlyContribution: z.number().min(0),
  contributionEndAge: z.number().int().min(0).max(120).nullable(),
  minAccessAge: z.number().int().min(50).max(75).nullable(),
  drawdownPriority: z.number().int().min(0),
});

export const updatePlanLiabilitySchema = z
  .object({
    liabilityId: z.string().uuid(),
    label: z.string().min(1),
    openingBalance: z.number().min(0),
    interestPct: z.number().min(-20).max(30),
    monthlyRepayment: z.number().min(0),
    startAge: z.number().int().min(0).max(120).nullable(),
    endAge: z.number().int().min(40).max(120).nullable(),
    linkedAssetId: z.string().uuid().nullable(),
    interestOnly: z.boolean(),
    revisionAge: z.number().int().min(0).max(120).nullable(),
    revisionRate: z.number().min(-20).max(30).nullable(),
  })
  .refine(
    (p) => p.startAge === null || p.endAge === null || p.startAge <= p.endAge,
    { message: "Start age must not be after the paid-off age" },
  );

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
const EXPENSE_SECTION = z.enum(["FIXED", "VARIABLE", "DISCRETIONARY"]);
const EVENT_DIRECTION = z.enum(["INFLOW", "OUTFLOW"]);
const EVENT_KIND = z.enum(["MANUAL", "PROPERTY_SALE"]);

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
  section: EXPENSE_SECTION,
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120).nullable(),
  endAge: z.number().int().min(0).max(120).nullable(),
  inflationLinked: z.boolean(),
});

export const updatePlanEventSchema = z
  .object({
    eventId: z.string().uuid(),
    label: z.string().min(1),
    age: z.number().int().min(0).max(120),
    direction: EVENT_DIRECTION,
    amount: z.number().min(0),
    kind: EVENT_KIND,
    assetId: z.string().uuid().nullable(),
  })
  .refine((p) => p.kind !== "PROPERTY_SALE" || p.assetId !== null, {
    message: "A property sale must reference a property",
  });

export const deleteRowSchema = z.object({ id: z.string().uuid() });

export type UpdatePlanIncomeInput = z.infer<typeof updatePlanIncomeSchema>;
export type UpdatePlanExpenseInput = z.infer<typeof updatePlanExpenseSchema>;
export type UpdatePlanEventInput = z.infer<typeof updatePlanEventSchema>;

// ─── Creating a row ─────────────────────────────────────────────────────────
//
// A row is created once, from a filled-in drawer, rather than written with
// placeholder values and edited afterwards. That is why label and the opening
// figure are required here: a row that exists with "New asset" and 0 in it is
// indistinguishable from one the user meant to leave at zero.

// What a new property should do about a mortgage, and what a new mortgage
// should do about a property. The link is one-to-one (PlanLiability
// .linkedAssetId is @unique), so EXISTING can only name something not already
// spoken for — the action re-checks that rather than trusting the client.
// NEW carries its own label: a half named by the app rather than the user is
// the placeholder value this whole flow exists to get rid of.
const mortgageChoice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("NONE") }),
  z.object({ mode: z.literal("NEW"), label: z.string().min(1) }),
  z.object({ mode: z.literal("EXISTING"), liabilityId: z.string().uuid() }),
]);

const propertyChoice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("NONE") }),
  z.object({ mode: z.literal("NEW"), label: z.string().min(1) }),
  z.object({ mode: z.literal("EXISTING"), assetId: z.string().uuid() }),
]);

export const createPlanAssetSchema = z
  .object({
    label: z.string().min(1),
    wrapper: WRAPPER,
    openingValue: z.number().min(0),
    mortgage: mortgageChoice.optional(),
  })
  .refine((a) => a.wrapper === "PROPERTY" || a.mortgage === undefined, {
    message: "Only a property can carry a mortgage",
    path: ["mortgage"],
  });

export const createPlanLiabilitySchema = z.object({
  label: z.string().min(1),
  openingBalance: z.number().min(0),
  property: propertyChoice.optional(),
});

export type CreatePlanAssetInput = z.infer<typeof createPlanAssetSchema>;
export type CreatePlanLiabilityInput = z.infer<
  typeof createPlanLiabilitySchema
>;

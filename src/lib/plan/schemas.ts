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

// ─── Editing a row Sync also writes ────────────────────────────────────────
//
// Every quantity below that a Sync copies from an account is bounded by its
// *column*, not by plausibility. The bounds used to be judgements about what a
// person would type — interest -20…30, fees 0…5, access age 50…75, paid-off
// age 40…120 — which was wrong in a way that only showed up once Sync started
// writing these columns: applySyncPlan writes through Prisma, bypassing zod,
// so an out-of-bounds figure lands in the row and then *every* later edit of
// that row re-sends it through this schema and throws. A 39.9% overdraft (the
// going UK rate), a mortgage cleared before 40, a SIPP with a protected access
// age of 45, a fund with a 6% charge: each of those is real, and each locked
// its plan row permanently — a label change or a timeline drag could never be
// saved again.
//
// So the plausibility bounds widen to the account side's column-derived range
// (DECIMAL(5,2) → ±999.99; DECIMAL(14,2) balances unbounded; see
// accountTermsSchema). Reality is the truth: Sync must not clamp a rate the
// user really pays, and the account side must not refuse to record it.
//
// Deliberately NOT widened: monthlyContribution/monthlyRepayment stay
// `min(0)`, because the budget rows they are fed from are `nonnegative()`
// themselves (src/lib/budget/schemas.ts), and the fields Sync never writes —
// contributionEndAge, drawdownPriority, startAge — keep the bounds they had.
const columnPct = z.number().min(-999.99).max(999.99);

export const updatePlanAssetSchema = z.object({
  assetId: z.string().uuid(),
  label: z.string().min(1),
  wrapper: WRAPPER,
  // Unbounded like BalanceItem.value, the observation Sync copies here: an
  // overdrawn current account is an asset row with a negative balance.
  openingValue: z.number(),
  expectedReturnPct: columnPct.nullable(),
  feePct: columnPct,
  monthlyContribution: z.number().min(0),
  contributionEndAge: z.number().int().min(0).max(120).nullable(),
  // 0…120, exactly as AccountTerms.minAccessAge accepts.
  minAccessAge: z.number().int().min(0).max(120).nullable(),
  drawdownPriority: z.number().int().min(0),
});

export const updatePlanLiabilitySchema = z
  .object({
    liabilityId: z.string().uuid(),
    label: z.string().min(1),
    openingBalance: z.number(),
    interestPct: columnPct,
    monthlyRepayment: z.number().min(0),
    startAge: z.number().int().min(0).max(120).nullable(),
    // The two age fields Sync writes carry no range at all. They are not
    // typed as ages: reality.ts derives them from AccountTerms.revisionDate
    // and endDate (calendar year minus the year of birth), and a date input
    // accepts any year — so any integer can legitimately arrive, and a bound
    // here would lock the row rather than stop the odd date. A nonsense age
    // simply never triggers in the projection's year loop.
    endAge: z.number().int().nullable(),
    linkedAssetId: z.string().uuid().nullable(),
    interestOnly: z.boolean(),
    revisionAge: z.number().int().nullable(),
    revisionRate: columnPct.nullable(),
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

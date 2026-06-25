import { projectWithBand } from "@/lib/plan";
import { serializedToPlanInput } from "@/lib/plan/serializedInput";
import { toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import { computeLiveBand } from "./liveBand";
import type { SerializedPlan } from "./serialized";

// minimal serialized plan (reuse the shape from serializedInput.test.ts)
const plan: SerializedPlan = {
  assumptions: {
    id: "11111111-1111-4111-8111-111111111111",
    dateOfBirth: "1982-09-07",
    retirementAge: 60,
    planToAge: 95,
    inflationPct: 2.5,
    defaultReturnPct: 5,
    returnSpreadPct: 2,
    blendedTaxRatePct: 20,
    statePensionAge: 67,
    statePensionAnnual: 11500,
  },
  assets: [
    {
      id: "a1",
      label: "SIPP",
      wrapper: "PENSION",
      openingValue: 100000,
      expectedReturnPct: null,
      feePct: 0,
      annualContribution: 6000,
      contributionEndAge: null,
      minAccessAge: 57,
      drawdownPriority: 2,
    },
  ],
  liabilities: [],
  incomes: [
    {
      id: "i1",
      label: "Salary",
      kind: "SALARY",
      annualAmount: 36000,
      startAge: null,
      endAge: 60,
      growthKind: "INFLATION",
      growthPct: null,
      taxable: true,
    },
  ],
  expenses: [
    {
      id: "e1",
      label: "Rent",
      category: "FIXED",
      annualAmount: 14400,
      startAge: null,
      endAge: null,
      inflationLinked: true,
    },
  ],
  events: [],
};

const serverBand = toTodaysMoneyBand(
  projectWithBand(serializedToPlanInput(plan, 2026)),
  plan.assumptions.inflationPct,
  2026 - 1982,
);

describe("computeLiveBand", () => {
  it("returns the server band unchanged when there are no overrides", () => {
    expect(computeLiveBand(plan, {}, serverBand, 2026)).toBe(serverBand);
  });

  it("recomputes for an override but carries the server earliest-retirement value", () => {
    const live = computeLiveBand(plan, { retirementAge: 68 }, serverBand, 2026);
    expect(live).not.toBe(serverBand);
    // earliest-retirement is NOT recomputed live — carried from the server band
    expect(live.verdict.earliestSustainableRetirementAge).toBe(
      serverBand.verdict.earliestSustainableRetirementAge,
    );
    // retiring later changes the year series
    expect(live.mid).not.toEqual(serverBand.mid);
  });
});

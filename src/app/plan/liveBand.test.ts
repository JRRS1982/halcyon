import { projectWithBand } from "@/lib/plan";
import { serializedToPlanInput } from "@/lib/plan/serializedInput";
import { toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import { computeLiveBand, withStreamAges } from "./liveBand";
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
      liabilityId: null,
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
    expect(
      computeLiveBand(
        plan,
        { assumptions: {}, events: {}, streams: {} },
        serverBand,
        2026,
      ),
    ).toBe(serverBand);
  });

  it("recomputes for an assumption override but carries the server earliest value", () => {
    const live = computeLiveBand(
      plan,
      { assumptions: { retirementAge: 68 }, events: {}, streams: {} },
      serverBand,
      2026,
    );
    expect(live).not.toBe(serverBand);
    expect(live.verdict.earliestSustainableRetirementAge).toBe(
      serverBand.verdict.earliestSustainableRetirementAge,
    );
    expect(live.mid).not.toEqual(serverBand.mid);
  });

  it("recomputes when an event age is overridden", () => {
    // plan must have an event for this; add one to the test plan fixture:
    const withEvent: SerializedPlan = {
      ...plan,
      events: [
        {
          id: "ev1",
          label: "Car",
          age: 50,
          direction: "OUTFLOW",
          amount: 20000,
        },
      ],
    };
    const base = computeLiveBand(
      withEvent,
      { assumptions: {}, events: {}, streams: {} },
      serverBand,
      2026,
    );
    const moved = computeLiveBand(
      withEvent,
      { assumptions: {}, events: { ev1: 60 }, streams: {} },
      serverBand,
      2026,
    );
    expect(moved).not.toBe(serverBand);
    expect(moved.mid).not.toEqual(base.mid);
  });

  it("recomputes when a stream's end age is overridden", () => {
    // The fixture salary (i1) ends at 60; extending it to 70 adds earning years,
    // so the projected band must diverge from the server band.
    const moved = computeLiveBand(
      plan,
      { assumptions: {}, events: {}, streams: { i1: { endAge: 70 } } },
      serverBand,
      2026,
    );
    expect(moved).not.toBe(serverBand);
    expect(moved.mid).not.toEqual(serverBand.mid);
  });
});

describe("withStreamAges", () => {
  it("applies a start-age override, e.g. for a dragged liability start handle", () => {
    expect(
      withStreamAges({ startAge: null, endAge: 70 }, { startAge: 48 }).startAge,
    ).toBe(48);
  });
});

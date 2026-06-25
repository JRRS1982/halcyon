import type { SerializedPlan } from "@/app/plan/serialized";
import { serializedToPlanInput } from "./serializedInput";

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
      feePct: 0.5,
      annualContribution: 6000,
      contributionEndAge: null,
      minAccessAge: 57,
      drawdownPriority: 2,
    },
  ],
  liabilities: [
    {
      id: "l1",
      label: "Mortgage",
      openingBalance: 120000,
      interestPct: 4,
      monthlyRepayment: 1100,
      endAge: 60,
    },
  ],
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
  events: [
    { id: "ev1", label: "Car", age: 50, direction: "OUTFLOW", amount: 20000 },
  ],
};

describe("serializedToPlanInput", () => {
  it("maps assumptions, derives currentAge/startYear, and carries new fields", () => {
    const input = serializedToPlanInput(plan, 2026);
    expect(input.currentAge).toBe(2026 - 1982);
    expect(input.startYear).toBe(2026);
    expect(input.retirementAge).toBe(60);
    expect(input.taxRatePct).toBe(20); // blendedTaxRatePct → taxRatePct
    expect(input.returnSpreadPct).toBe(2);
    expect(input.statePension).toEqual({ startAge: 67, annualAmount: 11500 });
    expect(input.assets[0]).toMatchObject({
      expectedReturnPct: undefined, // null → undefined (engine default)
      feePct: 0.5,
      contributionEndAge: undefined,
      minAccessAge: 57,
    });
    expect(input.incomes[0]?.growth).toEqual({ kind: "INFLATION" });
    expect(input.events[0]).toMatchObject({
      age: 50,
      direction: "OUTFLOW",
      amount: 20000,
    });
  });

  it("omits statePension when either field is null", () => {
    const input = serializedToPlanInput(
      { ...plan, assumptions: { ...plan.assumptions, statePensionAge: null } },
      2026,
    );
    expect(input.statePension).toBeUndefined();
  });
});

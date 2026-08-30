import type { SerializedPlan } from "@/app/(app)/plan/serialized";
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
    taxRegime: "SCOTLAND",
    thresholdsInflationLinked: false,
    statePensionAge: 67,
    statePensionAnnual: 11500,
    expectedDeathAge: 90,
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
      startAge: 45,
      endAge: 60,
      linkedAssetId: "a1",
      interestOnly: true,
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
      section: "FIXED",
      annualAmount: 14400,
      startAge: null,
      endAge: null,
      inflationLinked: true,
      liabilityId: "liab-1",
    },
  ],
  events: [
    {
      id: "ev1",
      label: "Car",
      age: 50,
      direction: "OUTFLOW",
      amount: 20000,
      kind: "PROPERTY_SALE",
      assetId: "22222222-2222-4222-8222-222222222222",
    },
  ],
};

describe("serializedToPlanInput", () => {
  it("maps assumptions, derives currentAge/startYear, and carries new fields", () => {
    const input = serializedToPlanInput(plan, 2026);
    expect(input.currentAge).toBe(2026 - 1982);
    expect(input.startYear).toBe(2026);
    expect(input.retirementAge).toBe(60);
    expect(input.taxRegime).toBe("SCOTLAND");
    expect(input.thresholdsInflationLinked).toBe(false);
    expect(input.returnSpreadPct).toBe(2);
    expect(input.statePension).toEqual({ startAge: 67, annualAmount: 11500 });
    expect(input.assets[0]?.expectedReturnPct).toBeUndefined();
    expect(input.assets[0]?.contributionEndAge).toBeUndefined();
    expect(input.assets[0]).toMatchObject({
      feePct: 0.5,
      minAccessAge: 57,
    });
    expect(input.incomes[0]?.growth).toEqual({ kind: "INFLATION" });
    expect(input.events[0]).toMatchObject({
      age: 50,
      direction: "OUTFLOW",
      amount: 20000,
      kind: "PROPERTY_SALE",
      assetId: "22222222-2222-4222-8222-222222222222",
    });
    expect(input.liabilities[0]?.startAge).toBe(45);
    expect(input.liabilities[0]?.interestOnly).toBe(true);
    expect(input.liabilities[0]?.linkedAssetId).toBe("a1");
    expect(input.expenses[0]?.liabilityId).toBe("liab-1");
  });

  it("omits statePension when either field is null", () => {
    const input = serializedToPlanInput(
      { ...plan, assumptions: { ...plan.assumptions, statePensionAge: null } },
      2026,
    );
    expect(input.statePension).toBeUndefined();
  });
});

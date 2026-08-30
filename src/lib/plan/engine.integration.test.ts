// src/lib/plan/engine.integration.test.ts
import { type PlanInput, project, type YearProjection } from "./index";

const plan: PlanInput = {
  currentAge: 50,
  startYear: 2026,
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 2.5,
  defaultReturnPct: 5,
  taxRegime: "RUK",
  thresholdsInflationLinked: true,
  statePension: { startAge: 67, annualAmount: 11000 },
  assets: [
    {
      id: "cash",
      label: "Cash",
      wrapper: "CASH",
      openingValue: 30000,
      expectedReturnPct: 1,
      drawdownPriority: 0,
    },
    {
      id: "isa",
      label: "ISA",
      wrapper: "ISA",
      openingValue: 80000,
      drawdownPriority: 1,
    },
    {
      id: "sipp",
      label: "SIPP",
      wrapper: "PENSION",
      openingValue: 200000,
      annualContribution: 8000,
      drawdownPriority: 2,
    },
    {
      id: "house",
      label: "Home",
      wrapper: "PROPERTY",
      openingValue: 400000,
      expectedReturnPct: 2,
      drawdownPriority: 9,
    },
  ],
  liabilities: [
    {
      id: "mortgage",
      label: "Mortgage",
      openingBalance: 160000,
      interestPct: 4,
      monthlyRepayment: 1200,
      linkedAssetId: "house",
    },
  ],
  incomes: [
    {
      id: "salary",
      label: "Salary",
      kind: "SALARY",
      annualAmount: 60000,
      endAge: 64,
      growth: { kind: "INFLATION" },
      taxable: true,
    },
  ],
  expenses: [
    {
      id: "living",
      label: "Living",
      section: "FIXED",
      annualAmount: 28000,
      inflationLinked: true,
    },
    {
      id: "uni",
      label: "University",
      section: "DISCRETIONARY",
      annualAmount: 12000,
      startAge: 52,
      endAge: 57,
      inflationLinked: true,
    },
  ],
  events: [],
};

const atAge = (years: YearProjection[], age: number): YearProjection => {
  const y = years.find((row) => row.age === age);
  if (!y) throw new Error(`no projection year at age ${age}`);
  return y;
};
const assetOf = (y: YearProjection, id: string) => {
  const a = y.assets.find((row) => row.id === id);
  if (!a) throw new Error(`no asset ${id} at age ${y.age}`);
  return a;
};

describe("plan engine — realistic integration", () => {
  it("projects every year from 50 to 95", () => {
    const { years } = project(plan);
    expect(years).toHaveLength(46);
    expect(years[0]?.age).toBe(50);
    expect(years.at(-1)?.age).toBe(95);
  });
  it("grows the SIPP via contributions while working", () => {
    const { years } = project(plan);
    // Check age 50 (first year, before university costs make cashflow negative at 52–57).
    // Contributions are funded only from operating cash flow, so they are 0 when
    // net cashflow before contributions is negative (correct behaviour post-fix).
    const sipp = assetOf(atAge(years, 50), "sipp");
    expect(sipp.contributed).toBeGreaterThan(0);
    expect(sipp.value).toBeGreaterThan(200000);
  });
  it("clears the mortgage by its endAge", () => {
    const { years } = project(plan);
    expect(atAge(years, 64).liabilityRepayments).toBeGreaterThan(0);
    expect(atAge(years, 70).liabilitiesTotal).toBe(0);
  });
  it("adds the state pension to income by kind from age 67", () => {
    const { years } = project(plan);
    expect(atAge(years, 66).incomeByKind.STATE_PENSION ?? 0).toBe(0);
    expect(atAge(years, 67).incomeByKind.STATE_PENSION ?? 0).toBeGreaterThan(
      9000,
    );
  });
  it("produces a verdict", () => {
    const { verdict } = project(plan);
    expect(verdict.netWorthAtRetirement?.value).toBeGreaterThan(0);
    expect(typeof verdict.feasible).toBe("boolean");
  });
});

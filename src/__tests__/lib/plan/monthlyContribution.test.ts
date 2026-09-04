import { type PlanInput, project } from "@/lib/plan";
import { annualFromMonthly } from "@/lib/plan/helpers";

// The engine's only entry point is project(input) — there is no per-step
// export to call, so contributions are asserted through a projection.
const base: PlanInput = {
  currentAge: 40,
  startYear: 2026,
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 0,
  defaultReturnPct: 0,
  taxRegime: "RUK",
  thresholdsInflationLinked: false,
  assets: [],
  liabilities: [],
  incomes: [],
  expenses: [],
  events: [],
};

describe("monthly contributions", () => {
  it("pays in twelve times the monthly figure over a year", () => {
    const result = project({
      ...base,
      // Contributions are funded from the year's operating cash flow, so an
      // income exactly matching the contribution keeps the surplus at zero
      // and lets the whole amount land in the asset, unscaled.
      incomes: [
        {
          id: "salary",
          label: "Salary",
          kind: "OTHER",
          annualAmount: 1200,
          growth: { kind: "NONE" },
          taxable: false,
        },
      ],
      assets: [
        {
          id: "a1",
          label: "ISA",
          wrapper: "ISA",
          openingValue: 0,
          expectedReturnPct: 0,
          monthlyContribution: 100,
          drawdownPriority: 0,
        },
      ],
    });

    // No growth and no inflation, so the first year's balance is exactly its
    // payments — the row for age 40 (currentAge) already covers one full year.
    const afterOneYear = result.years.find((y) => y.age === 40);
    const a1 = afterOneYear?.assets.find((a) => a.id === "a1");
    expect(a1?.value).toBeCloseTo(1200, 2);
  });

  it("derives the annual read-out as what twelve payments actually come to", () => {
    // £10,000/yr is not payable in equal monthly instalments: the honest
    // read-out is £9,999.96, and showing £10,000 would make the label
    // disagree with the projection.
    expect(annualFromMonthly(833.33)).toBe(9999.96);
  });

  it("round-trips a monthly figure without drift", () => {
    expect(annualFromMonthly(0)).toBe(0);
    expect(annualFromMonthly(500)).toBe(6000);
  });
});

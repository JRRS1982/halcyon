// src/lib/plan/dbPension.test.ts
//
// A final-salary (DB) pension is a pot until AssetInput.annualIncome is set,
// then it converts to an income at incomeFromAge and its balance is excluded
// from the projection entirely — see the comment on AssetInput.annualIncome
// for why (projecting the pot AND paying the income double-counts it).
import { type AssetInput, type PlanInput, project } from "@/lib/plan";

// Born so that age 65 is reached in 2051 — the exact year doesn't matter,
// only that the projection runs long enough to observe the conversion.
const base: PlanInput = {
  currentAge: 40,
  startYear: 2026,
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 0,
  defaultReturnPct: 5,
  taxRegime: "RUK",
  thresholdsInflationLinked: false,
  assets: [],
  liabilities: [],
  incomes: [],
  expenses: [],
  events: [],
};

const dbPension: AssetInput = {
  id: "db1",
  label: "Old scheme",
  wrapper: "DB_PENSION",
  // A transfer value the user tracks on their balance sheet, not a pot the
  // plan grows.
  openingValue: 250_000,
  drawdownPriority: 0,
  annualIncome: 12_000,
  incomeFromAge: 65,
};

const assetValue = (
  projection: ReturnType<typeof project>,
  age: number,
  id: string,
): number | undefined =>
  projection.years.find((y) => y.age === age)?.assets.find((a) => a.id === id)
    ?.value;

const incomeAt = (
  projection: ReturnType<typeof project>,
  age: number,
): number =>
  projection.years.find((y) => y.age === age)?.incomeByKind.DB_PENSION ?? 0;

describe("a DB pension with an entitlement", () => {
  it("contributes nothing to the projected balance", () => {
    const result = project({ ...base, assets: [dbPension] });
    expect(assetValue(result, 41, "db1")).toBe(0);
  });

  it("pays no income before the conversion age", () => {
    const result = project({ ...base, assets: [dbPension] });
    expect(incomeAt(result, 60)).toBe(0);
  });

  it("pays the entitlement from the conversion age to the end of the plan", () => {
    const result = project({ ...base, assets: [dbPension] });
    expect(incomeAt(result, 65)).toBeCloseTo(12_000, 2);
    expect(incomeAt(result, 80)).toBeCloseTo(12_000, 2);
  });

  it("still grows a DB pension with no entitlement set", () => {
    // Without an annualIncome the row is just an asset, and excluding it
    // would silently zero a balance the user does track.
    const result = project({
      ...base,
      assets: [
        {
          id: "db2",
          label: "Old scheme",
          wrapper: "DB_PENSION",
          openingValue: 250_000,
          expectedReturnPct: 5,
          drawdownPriority: 0,
        },
      ],
    });

    expect(assetValue(result, 41, "db2")).toBeGreaterThan(250_000);
  });
});

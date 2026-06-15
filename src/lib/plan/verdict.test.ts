import type { YearProjection } from "./types";
// src/lib/plan/verdict.test.ts
import { summarise } from "./verdict";

const year = (
  over: Partial<YearProjection> & { age: number },
): YearProjection => ({
  year: 2000 + over.age,
  grossIncome: 0,
  incomeByKind: {},
  tax: 0,
  netIncome: 0,
  expensesByCategory: {},
  totalExpenses: 0,
  liabilityRepayments: 0,
  surplus: 0,
  contributions: 0,
  withdrawals: 0,
  assets: [],
  liabilities: [],
  liabilitiesTotal: 0,
  netWorth: 0,
  shortfall: false,
  ...over,
});

describe("summarise", () => {
  it("is feasible with no shortfall and reports peak net worth", () => {
    const v = summarise([
      year({ age: 60, netWorth: 100000 }),
      year({ age: 61, netWorth: 250000 }),
      year({ age: 62, netWorth: 180000 }),
    ]);
    expect(v.feasible).toBe(true);
    expect(v.firstShortfallAge).toBeNull();
    expect(v.peakNetWorth).toEqual({ age: 61, value: 250000 });
  });
  it("reports the first shortfall age and is not feasible", () => {
    const v = summarise([
      year({ age: 88, netWorth: 20000 }),
      year({ age: 89, netWorth: 0, shortfall: true }),
    ]);
    expect(v.feasible).toBe(false);
    expect(v.firstShortfallAge).toBe(89);
  });
});

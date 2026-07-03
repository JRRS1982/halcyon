// src/lib/plan/toPlanInput.test.ts
import { project } from "@/lib/plan";
import {
  type PlanWithChildren,
  toPlanInput,
  toTodaysMoney,
  toTodaysMoneyBand,
} from "./toPlanInput";
import type { PlanProjection, YearProjection } from "./types";

const yr = (age: number, netWorth: number): YearProjection => ({
  age,
  year: 2026 + (age - 40),
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
  netWorth,
  shortfall: netWorth < 0,
});

const proj = (
  peakAge: number,
  peak: number,
  years: YearProjection[],
): PlanProjection => ({
  years,
  verdict: {
    feasible: years.every((y) => !y.shortfall),
    firstShortfallAge: years.find((y) => y.shortfall)?.age ?? null,
    peakNetWorth: { age: peakAge, value: peak },
    earliestSustainableRetirementAge: null,
  },
});

const d = (n: number) =>
  ({
    toString: () => String(n),
  }) as unknown as PlanWithChildren["inflationPct"];

const basePlan = (over: Partial<PlanWithChildren> = {}): PlanWithChildren => ({
  id: "p1",
  userId: "u1",
  name: "My plan",
  dateOfBirth: new Date("1986-06-01"),
  retirementAge: 65,
  planToAge: 90,
  inflationPct: d(2.5),
  defaultReturnPct: d(5),
  returnSpreadPct: d(0),
  blendedTaxRatePct: d(20),
  statePensionAge: 67,
  statePensionAnnual: d(11000),
  isPrimary: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  assets: [],
  liabilities: [],
  incomes: [],
  expenses: [],
  events: [],
  ...over,
});

describe("toPlanInput", () => {
  it("derives currentAge and startYear from dateOfBirth and asOfYear", () => {
    const input = toPlanInput(basePlan(), 2026);
    expect(input.currentAge).toBe(40); // 2026 - 1986
    expect(input.startYear).toBe(2026);
    expect(input.taxRatePct).toBe(20);
    expect(input.statePension).toEqual({ startAge: 67, annualAmount: 11000 });
  });

  it("omits statePension when age or amount is missing", () => {
    const input = toPlanInput(basePlan({ statePensionAge: null }), 2026);
    expect(input.statePension).toBeUndefined();
  });

  it("maps an asset, leaving expectedReturnPct undefined when null", () => {
    const input = toPlanInput(
      basePlan({
        assets: [
          {
            id: "a1",
            planId: "p1",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: d(100000),
            expectedReturnPct: null,
            feePct: d(0),
            annualContribution: d(6000),
            contributionEndAge: null,
            minAccessAge: null,
            drawdownPriority: 2,
            sourceBalanceItemId: null,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      }),
      2026,
    );
    expect(input.assets[0]).toMatchObject({
      id: "a1",
      label: "SIPP",
      wrapper: "PENSION",
      openingValue: 100000,
      annualContribution: 6000,
      drawdownPriority: 2,
    });
    expect(input.assets[0]?.expectedReturnPct).toBeUndefined();
  });

  it("maps a liability with startAge", () => {
    const input = toPlanInput(
      basePlan({
        liabilities: [
          {
            id: "liab-1",
            planId: "p1",
            label: "Mortgage",
            openingBalance: d(100000),
            interestPct: d(4),
            monthlyRepayment: d(500),
            startAge: 45,
            endAge: 65,
            linkedAssetId: null,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      }),
      2026,
    );
    expect(input.liabilities[0]).toMatchObject({
      id: "liab-1",
      label: "Mortgage",
      openingBalance: 100000,
      interestPct: 4,
      monthlyRepayment: 500,
    });
    expect(input.liabilities[0]?.startAge).toBe(45);
  });

  it("maps an expense with liabilityId", () => {
    const input = toPlanInput(
      basePlan({
        expenses: [
          {
            id: "exp-1",
            planId: "p1",
            label: "Groceries",
            category: "VARIABLE",
            annualAmount: d(7200),
            startAge: null,
            endAge: null,
            inflationLinked: true,
            liabilityId: "liab-1",
            sourceCategoryId: null,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      }),
      2026,
    );
    expect(input.expenses[0]).toMatchObject({
      id: "exp-1",
      label: "Groceries",
      category: "VARIABLE",
      annualAmount: 7200,
      inflationLinked: true,
    });
    expect(input.expenses[0]?.liabilityId).toBe("liab-1");
  });

  it("the mapped plan runs through the engine", () => {
    const out = project(toPlanInput(basePlan(), 2026));
    expect(out.years[0]?.age).toBe(40);
    expect(out.years.at(-1)?.age).toBe(90);
  });
});

describe("toTodaysMoney", () => {
  it("deflates money by inflation over elapsed years", () => {
    const out = project(toPlanInput(basePlan({ planToAge: 41 }), 2026));
    const real = toTodaysMoney(out, 10, 40); // 10% inflation
    // age 41 is 1 year out → divide by 1.1
    const nominal41 = out.years.find((y) => y.age === 41);
    const real41 = real.years.find((y) => y.age === 41);
    expect(real41?.netWorth).toBeCloseTo((nominal41?.netWorth ?? 0) / 1.1, 0);
  });
});

describe("toTodaysMoneyBand", () => {
  it("anchors the verdict on mid and derives ranges from deflated peaks", () => {
    // inflation 0 so deflation is identity — ranges equal nominal min/max.
    const low = proj(40, 80, [yr(40, 80)]);
    const mid = proj(40, 100, [yr(40, 100)]);
    const high = proj(40, 130, [yr(40, 130)]);
    const banded = toTodaysMoneyBand({ low, mid, high }, 0, 40);

    expect(banded.verdict.peakNetWorth.value).toBe(100); // anchored on mid
    expect(banded.verdict.peakNetWorthRange).toEqual([80, 130]);
    expect(banded.mid).toEqual(mid.years);
  });

  it("reports a shortfall-age range and null when no pass shorts", () => {
    const noShort = proj(40, 100, [yr(40, 100)]);
    const allClear = toTodaysMoneyBand(
      { low: noShort, mid: noShort, high: noShort },
      0,
      40,
    );
    expect(allClear.verdict.firstShortfallAgeRange).toBeNull();

    const low = proj(40, -10, [yr(40, 100), yr(41, -10)]);
    const mid = proj(40, 100, [yr(40, 100), yr(41, 50)]);
    const high = proj(40, 100, [yr(40, 100), yr(41, 80)]);
    const banded = toTodaysMoneyBand({ low, mid, high }, 0, 40);
    expect(banded.verdict.firstShortfallAgeRange).toEqual([41, 41]);
  });
});

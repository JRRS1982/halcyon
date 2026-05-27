import {
  budgetVsActualTrend,
  cashFlowSeries,
  composition,
  netWorthSeries,
} from "@/lib/dashboard/series";

describe("netWorthSeries", () => {
  test("sums each side's buckets and computes assets minus liabilities", () => {
    const out = netWorthSeries([
      {
        month: "Jan 25",
        assetCurrent: 100,
        assetLongTerm: 200,
        assetOther: 50,
        liabilityCurrent: 40,
        liabilityLongTerm: 60,
        liabilityOther: 0,
      },
    ]);
    expect(out).toEqual([
      { month: "Jan 25", assets: 350, liabilities: 100, netWorth: 250 },
    ]);
  });

  test("net worth goes negative when liabilities exceed assets", () => {
    const [point] = netWorthSeries([
      {
        month: "Feb 25",
        assetCurrent: 10,
        assetLongTerm: 0,
        assetOther: 0,
        liabilityCurrent: 30,
        liabilityLongTerm: 0,
        liabilityOther: 0,
      },
    ]);
    expect(point.netWorth).toBe(-20);
  });
});

describe("cashFlowSeries", () => {
  test("computes net and savings rate for a surplus month", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 4000, expense: 3000 },
    ]);
    expect(point.net).toBe(1000);
    expect(point.savingsRatePct).toBe(25);
  });

  test("savings rate is 0 when income is 0 (no divide-by-zero)", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 0, expense: 500 },
    ]);
    expect(point.savingsRatePct).toBe(0);
    expect(point.net).toBe(-500);
  });

  test("savings rate is negative when overspending income", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 2000, expense: 3000 },
    ]);
    expect(point.net).toBe(-1000);
    expect(point.savingsRatePct).toBe(-50);
  });
});

describe("budgetVsActualTrend", () => {
  const months = Array.from({ length: 8 }, (_, i) => ({
    month: `M${i}`,
    budget: i,
    actual: i,
  }));

  test("returns only the last 6 months", () => {
    const out = budgetVsActualTrend(months);
    expect(out.map((m) => m.month)).toEqual([
      "M2",
      "M3",
      "M4",
      "M5",
      "M6",
      "M7",
    ]);
  });

  test("returns all months when fewer than the window", () => {
    const out = budgetVsActualTrend(months.slice(0, 3));
    expect(out).toHaveLength(3);
  });
});

describe("composition", () => {
  test("returns a slice per category", () => {
    const out = composition({ fixed: 100, variable: 50, discretionary: 25 });
    expect(out).toEqual([
      { name: "Fixed", value: 100 },
      { name: "Variable", value: 50 },
      { name: "Discretionary", value: 25 },
    ]);
  });

  test("drops categories with no spend so the donut has no empty slices", () => {
    const out = composition({ fixed: 100, variable: 0, discretionary: 0 });
    expect(out).toEqual([{ name: "Fixed", value: 100 }]);
  });
});

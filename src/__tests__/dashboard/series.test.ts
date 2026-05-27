import { balanceSeries, cashFlowSeries } from "@/lib/dashboard/series";

describe("balanceSeries", () => {
  const sums = (overrides = {}) => ({
    month: "Jan 25",
    assetCurrent: 100,
    assetLongTerm: 200,
    assetOther: 50,
    liabilityCurrent: 40,
    liabilityLongTerm: 60,
    liabilityOther: 10,
    ...overrides,
  });

  test("negates liability buckets so debt sits below zero, assets stay positive", () => {
    const [point] = balanceSeries([sums()]);
    expect(point.assetCurrent).toBe(100);
    expect(point.assetLongTerm).toBe(200);
    expect(point.assetOther).toBe(50);
    expect(point.liabilityCurrent).toBe(-40);
    expect(point.liabilityLongTerm).toBe(-60);
    expect(point.liabilityOther).toBe(-10);
  });

  test("net is total assets minus total liabilities", () => {
    const [point] = balanceSeries([sums()]);
    // assets 350 − liabilities 110
    expect(point.net).toBe(240);
  });

  test("net goes negative when liabilities exceed assets", () => {
    const [point] = balanceSeries([
      sums({
        assetCurrent: 10,
        assetLongTerm: 0,
        assetOther: 0,
        liabilityCurrent: 30,
        liabilityLongTerm: 0,
        liabilityOther: 0,
      }),
    ]);
    expect(point.net).toBe(-20);
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

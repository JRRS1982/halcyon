import {
  balanceSeries,
  cashFlowSeries,
  monthFlow,
} from "@/lib/dashboard/series";

describe("balanceSeries", () => {
  const sums = (overrides = {}) => ({
    month: "Jan 25",
    assetCurrent: 100,
    assetMediumTerm: 80,
    assetLongTerm: 200,
    assetProperty: 300,
    assetOther: 50,
    liabilityCurrent: 40,
    liabilityMediumTerm: 20,
    liabilityLongTerm: 60,
    liabilityOther: 10,
    ...overrides,
  });

  test("negates liability buckets so debt sits below zero, assets stay positive", () => {
    const [point] = balanceSeries([sums()]);
    expect(point?.assetCurrent).toBe(100);
    expect(point?.assetMediumTerm).toBe(80);
    expect(point?.assetLongTerm).toBe(200);
    expect(point?.assetProperty).toBe(300);
    expect(point?.assetOther).toBe(50);
    expect(point?.liabilityCurrent).toBe(-40);
    expect(point?.liabilityMediumTerm).toBe(-20);
    expect(point?.liabilityLongTerm).toBe(-60);
    expect(point?.liabilityOther).toBe(-10);
  });

  test("net is total assets minus total liabilities", () => {
    const [point] = balanceSeries([sums()]);
    // assets 100+80+200+300+50 = 730, liabilities 40+20+60+10 = 130
    expect(point?.net).toBe(600);
  });

  test("net goes negative when liabilities exceed assets", () => {
    const [point] = balanceSeries([
      sums({
        assetCurrent: 10,
        assetMediumTerm: 0,
        assetLongTerm: 0,
        assetProperty: 0,
        assetOther: 0,
        liabilityCurrent: 30,
        liabilityMediumTerm: 0,
        liabilityLongTerm: 0,
        liabilityOther: 0,
      }),
    ]);
    expect(point?.net).toBe(-20);
  });
});

describe("cashFlowSeries", () => {
  test("computes net and savings rate for a surplus month", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 4000, expense: 3000 },
    ]);
    expect(point?.net).toBe(1000);
    expect(point?.savingsRatePct).toBe(25);
  });

  test("savings rate is 0 when income is 0 (no divide-by-zero)", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 0, expense: 500 },
    ]);
    expect(point?.savingsRatePct).toBe(0);
    expect(point?.net).toBe(-500);
  });

  test("savings rate is negative when overspending income", () => {
    const [point] = cashFlowSeries([
      { month: "Jan 25", income: 2000, expense: 3000 },
    ]);
    expect(point?.net).toBe(-1000);
    expect(point?.savingsRatePct).toBe(-50);
  });
});

describe("monthFlow", () => {
  test("income and expenses are the two series", () => {
    expect(
      monthFlow([
        { type: "INCOME", actual: 8000 },
        { type: "EXPENSE", actual: 2000 },
        { type: "EXPENSE", actual: 500 },
      ]),
    ).toEqual({ income: 8000, expense: 2500 });
  });

  // The loop this replaces was `if INCOME … else expense`, which files a
  // transfer — money you still own — under spending the moment such a row
  // exists.
  test("a transfer is not spending", () => {
    expect(
      monthFlow([
        { type: "INCOME", actual: 8000 },
        { type: "TRANSFER", actual: 500 },
      ]),
    ).toEqual({ income: 8000, expense: 0 });
  });

  // A repayment's actual is netted by account, a source this chart does not
  // read, so counting it as spending would report a figure nothing computed.
  test("a repayment is not counted here either", () => {
    expect(
      monthFlow([
        { type: "EXPENSE", actual: 2000 },
        { type: "REPAYMENT", actual: 1250 },
      ]),
    ).toEqual({ income: 0, expense: 2000 });
  });

  test("a month with nothing in it flows nothing", () => {
    expect(monthFlow([])).toEqual({ income: 0, expense: 0 });
  });
});

import {
  accountBalanceSums,
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

describe("accountBalanceSums", () => {
  // The regression this closes: BalanceItem carries its own type/category
  // mirror columns, written at creation and never kept in step with a later
  // setAccountType/setAccountSection call on the account. A stale mirror must
  // not move the chart — only the account's current kindOf(type)/section may.
  test("follows the account's current type, not the item's stale mirror", () => {
    const sums = accountBalanceSums([
      {
        value: 500,
        // The item's own mirrors (absent from this input on purpose — the
        // function never reads them) would have said EXPENSE/ASSET:CURRENT
        // before the account was switched to a mortgage; only the account's
        // present-day type/section reach this function.
        account: { type: "MORTGAGE", section: "LONG_TERM" },
      },
    ]);

    expect(sums.liabilityLongTerm).toBe(500);
    expect(sums.assetCurrent).toBe(0);
  });

  test("sums assets and liabilities into the right bucket by account section", () => {
    const sums = accountBalanceSums([
      { value: 1000, account: { type: "CURRENT_ACCOUNT", section: "CURRENT" } },
      { value: 5000, account: { type: "SAVINGS", section: "MEDIUM_TERM" } },
      { value: 200000, account: { type: "PROPERTY", section: "PROPERTY" } },
      { value: 150000, account: { type: "MORTGAGE", section: "LONG_TERM" } },
      { value: 300, account: { type: "CREDIT_CARD", section: "CURRENT" } },
    ]);

    expect(sums.assetCurrent).toBe(1000);
    expect(sums.assetMediumTerm).toBe(5000);
    expect(sums.assetProperty).toBe(200000);
    expect(sums.liabilityLongTerm).toBe(150000);
    expect(sums.liabilityCurrent).toBe(300);
  });

  test("a month with nothing recorded sums to all zeroes", () => {
    const sums = accountBalanceSums([]);
    expect(Object.values(sums).every((v) => v === 0)).toBe(true);
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

  // A repayment IS spending — the budget sheet files it under Expenses and
  // `surplus` subtracts it. Excluding it here made converting a mortgage from
  // an EXPENSE category row to a REPAYMENT row look like the money stopped
  // going out.
  test("a repayment is spending", () => {
    expect(
      monthFlow([
        { type: "EXPENSE", actual: 2000 },
        { type: "REPAYMENT", actual: 1250 },
      ]),
    ).toEqual({ income: 0, expense: 3250 });
  });

  // The concrete regression: £4,000 in, £1,250 of ordinary expenses and a
  // £1,250 mortgage. Charting the mortgage as an EXPENSE category row and as a
  // REPAYMENT row must give the same savings rate — nothing about the user's
  // finances changed.
  test("converting a mortgage to a repayment does not move the savings rate", () => {
    const asExpense = monthFlow([
      { type: "INCOME", actual: 4000 },
      { type: "EXPENSE", actual: 1250 },
      { type: "EXPENSE", actual: 1250 },
    ]);
    const asRepayment = monthFlow([
      { type: "INCOME", actual: 4000 },
      { type: "EXPENSE", actual: 1250 },
      { type: "REPAYMENT", actual: 1250 },
    ]);

    expect(asRepayment).toEqual(asExpense);
    expect(
      cashFlowSeries([{ month: "Mar 26", ...asRepayment }])[0]?.savingsRatePct,
    ).toBe(37.5);
  });

  test("a month with nothing in it flows nothing", () => {
    expect(monthFlow([])).toEqual({ income: 0, expense: 0 });
  });
});

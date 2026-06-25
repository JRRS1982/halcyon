import { seedPlanChildren } from "./seed";

describe("seedPlanChildren", () => {
  it("maps balance assets to OTHER-wrapper PlanAssets with category-based drawdown order", () => {
    const r = seedPlanChildren(
      [
        {
          id: "b1",
          type: "ASSET",
          category: "CURRENT",
          label: "Cash",
          value: 5000,
        },
        {
          id: "b2",
          type: "ASSET",
          category: "LONG_TERM",
          label: "SIPP",
          value: 100000,
        },
      ],
      [],
      65,
    );
    expect(r.assets).toEqual([
      {
        label: "Cash",
        wrapper: "OTHER",
        openingValue: 5000,
        annualContribution: 0,
        drawdownPriority: 0,
        sourceBalanceItemId: "b1",
      },
      {
        label: "SIPP",
        wrapper: "OTHER",
        openingValue: 100000,
        annualContribution: 0,
        drawdownPriority: 2,
        sourceBalanceItemId: "b2",
      },
    ]);
  });

  it("skips balance items with a zero (or negative) value", () => {
    // A fully-paid credit card or an emptied account shouldn't bootstrap a dead
    // plan row — that's what produces a ghost full-width bar on the Timeline.
    const r = seedPlanChildren(
      [
        {
          id: "b1",
          type: "ASSET",
          category: "CURRENT",
          label: "Cash",
          value: 5000,
        },
        {
          id: "b2",
          type: "ASSET",
          category: "CURRENT",
          label: "Empty pot",
          value: 0,
        },
        {
          id: "b3",
          type: "LIABILITY",
          category: "CURRENT",
          label: "Credit Card",
          value: 0,
        },
        {
          id: "b4",
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 175000,
        },
      ],
      [],
      65,
    );
    expect(r.assets.map((a) => a.label)).toEqual(["Cash"]);
    expect(r.liabilities.map((l) => l.label)).toEqual(["Mortgage"]);
  });

  it("maps balance liabilities to PlanLiabilities (rates default 0)", () => {
    const r = seedPlanChildren(
      [
        {
          id: "b3",
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 120000,
        },
      ],
      [],
      65,
    );
    expect(r.liabilities).toEqual([
      {
        label: "Mortgage",
        openingBalance: 120000,
        interestPct: 0,
        monthlyRepayment: 0,
      },
    ]);
  });

  it("maps income items by kind, salary ends at retirement, amount = budget x 12", () => {
    const r = seedPlanChildren(
      [],
      [
        {
          type: "INCOME",
          incomeCategory: "SALARY",
          category: null,
          label: "Salary",
          budget: 4000,
          sourceCategoryId: "c1",
        },
        {
          type: "INCOME",
          incomeCategory: "PENSIONS",
          category: null,
          label: "DB pension",
          budget: 1000,
          sourceCategoryId: "c2",
        },
      ],
      65,
    );
    expect(r.incomes).toEqual([
      {
        label: "Salary",
        kind: "SALARY",
        annualAmount: 48000,
        taxable: true,
        growthKind: "INFLATION",
        endAge: 65,
      },
      {
        label: "DB pension",
        kind: "DB_PENSION",
        annualAmount: 12000,
        taxable: true,
        growthKind: "INFLATION",
        endAge: null,
      },
    ]);
  });

  it("maps expense items, carrying the category bucket, amount = budget x 12", () => {
    const r = seedPlanChildren(
      [],
      [
        {
          type: "EXPENSE",
          incomeCategory: null,
          category: "FIXED",
          label: "Rent",
          budget: 1200,
          sourceCategoryId: "c3",
        },
      ],
      65,
    );
    expect(r.expenses).toEqual([
      {
        label: "Rent",
        category: "FIXED",
        annualAmount: 14400,
        inflationLinked: true,
        sourceCategoryId: "c3",
      },
    ]);
  });
});

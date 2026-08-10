import { seedPlanChildren } from "./seed";

describe("seedPlanChildren", () => {
  it("maps balance assets to wrappers inferred from label/category, category-based drawdown order", () => {
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
        wrapper: "CASH",
        openingValue: 5000,
        annualContribution: 0,
        drawdownPriority: 0,
        sourceBalanceItemId: "b1",
      },
      {
        label: "SIPP",
        wrapper: "PENSION",
        openingValue: 100000,
        annualContribution: 0,
        drawdownPriority: 2,
        sourceBalanceItemId: "b2",
      },
    ]);
  });

  it.each([
    // label keyword wins over category
    ["My SIPP", "OTHER", "PENSION"],
    ["Workplace pension", "OTHER", "PENSION"],
    ["Cash ISA", "CURRENT", "ISA"],
    ["Vanguard GIA", "OTHER", "GIA"],
    ["Emergency cash", "OTHER", "CASH"],
    ["Holiday home", "OTHER", "PROPERTY"],
    // no keyword → category fallback
    ["Rainy-day fund", "CURRENT", "CASH"],
    ["Balanced portfolio", "MEDIUM_TERM", "GIA"],
    ["Nest egg", "LONG_TERM", "ISA"],
    ["Buy-to-let", "PROPERTY", "PROPERTY"],
    ["Misc", "OTHER", "OTHER"],
  ] as const)("infers wrapper for %s (%s) → %s", (label, category, wrapper) => {
    const r = seedPlanChildren(
      [{ id: "a", type: "ASSET", category, label, value: 1000 }],
      [],
      65,
    );
    expect(r.assets[0]?.wrapper).toBe(wrapper);
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

  it("skips budget rows with a zero (or negative) budget", () => {
    // A new account's first budget sheet is pre-filled with £0 starter rows, so
    // creating a plan before filling any of them in would otherwise seed a
    // table of empty income and expense lines.
    const r = seedPlanChildren(
      [],
      [
        {
          type: "INCOME",
          incomeCategory: "SALARY",
          category: null,
          label: "Salary",
          budget: 4000,
          sourceCategoryId: null,
        },
        {
          type: "INCOME",
          incomeCategory: "SIDE_INCOME",
          category: null,
          label: "Side Income",
          budget: 0,
          sourceCategoryId: null,
        },
        {
          type: "EXPENSE",
          incomeCategory: null,
          category: "FIXED",
          label: "Council Tax",
          budget: 180,
          sourceCategoryId: null,
        },
        {
          type: "EXPENSE",
          incomeCategory: null,
          category: "VARIABLE",
          label: "Groceries",
          budget: 0,
          sourceCategoryId: null,
        },
      ],
      65,
    );
    expect(r.incomes.map((i) => i.label)).toEqual(["Salary"]);
    expect(r.expenses.map((e) => e.label)).toEqual(["Council Tax"]);
  });

  it("maps balance liabilities to PlanLiabilities with an inferred interest rate", () => {
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
        interestPct: 4.5,
        monthlyRepayment: 0,
      },
    ]);
  });

  it.each([
    // label keyword wins over category
    ["Mortgage", "OTHER", 4.5],
    ["Credit Card", "CURRENT", 19.9],
    ["Overdraft", "CURRENT", 20],
    ["Car loan", "MEDIUM_TERM", 7],
    // no keyword → category fallback
    ["Home balance", "LONG_TERM", 4.5],
    ["Store account", "CURRENT", 18],
    ["Misc debt", "OTHER", 5],
  ] as const)(
    "infers interest for %s (%s) → %s%",
    (label, category, interestPct) => {
      const r = seedPlanChildren(
        [{ id: "l", type: "LIABILITY", category, label, value: 1000 }],
        [],
        65,
      );
      expect(r.liabilities[0]?.interestPct).toBe(interestPct);
    },
  );

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

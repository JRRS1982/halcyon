// e2e/dashboard-summary.spec.ts
//
// The dashboard leads with four figures rather than opening on a chart. These
// need real data in a real browser: the values come from two months of seeded
// periods, and the hydration check can only be made by loading the page.
import {
  clearStarterPeriods,
  expect,
  signIn,
  signedInUser,
  test,
} from "./_helpers/fixtures";

test.describe("Dashboard summary", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("leads with the headline figures and their direction", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    // These figures are derived from the latest recorded month, so the starter
    // sheet a new account is provisioned with has to go: it is more recent than
    // the fixture below and would be the month the KPIs report on.
    await clearStarterPeriods(db, user.id);
    // Two months of budget + balance so the KPI row has a delta to show.
    for (const [i, m] of [
      [0, "2026-01"],
      [1, "2026-02"],
    ] as const) {
      const start = new Date(Date.UTC(2026, i, 1));
      const end = new Date(Date.UTC(2026, i, 28));
      const period = await db.financialPeriod.create({
        data: {
          userId: user.id,
          granularity: "MONTH",
          startDate: start,
          endDate: end,
          label: m,
        },
      });
      await db.financialItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "INCOME",
            label: "Salary",
            budget: 3000,
            actual: 3000,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "FIXED",
            label: "Rent",
            budget: 1200,
            actual: 1200 + i * 200,
            sortOrder: 1,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "VARIABLE",
            label: "Food",
            budget: 400,
            actual: 380 + i * 90,
            sortOrder: 2,
          },
        ],
      });
      await db.balanceItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "ASSET",
            category: "CURRENT",
            label: "Savings",
            value: 12000 + i * 1500,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "LIABILITY",
            category: "LONG_TERM",
            label: "Mortgage",
            value: 90000 - i * 500,
            sortOrder: 1,
          },
        ],
      });
    }
    await page.goto("/dashboard");

    // Scoped to the KPI row, not the page. Several of these strings appear
    // again below — "Savings rate" is also a cash-flow series, so it shows up
    // in that chart's legend, and the explainers use the words in prose. The
    // charts are lazy-loaded, so page-wide locators match one element or two
    // depending on which render wins, which is a strict-mode violation about
    // one run in four rather than a real failure.
    const figures = page.getByRole("region", { name: "Key figures" });

    // Net worth: 13,500 saved against 89,500 owed in the second month.
    // The sign is whatever Intl produces for the locale — a Unicode minus, not
    // an ASCII hyphen — so match the magnitude and allow either.
    await expect(figures.getByText("Net worth")).toBeVisible();
    await expect(figures.getByText(/[-−–]£76,000/)).toBeVisible();

    // Spending overran the budget in month two, so this is over 100%.
    await expect(figures.getByText("Spend vs budget")).toBeVisible();
    await expect(figures.getByText("117%")).toBeVisible();

    for (const label of ["Surplus", "Savings rate"]) {
      await expect(figures.getByText(label, { exact: true })).toBeVisible();
    }
  });

  // Four charts each opened with a three-line paragraph, which pushed the data
  // itself below the fold.
  test("folds each chart's explanation away by default", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    // These figures are derived from the latest recorded month, so the starter
    // sheet a new account is provisioned with has to go: it is more recent than
    // the fixture below and would be the month the KPIs report on.
    await clearStarterPeriods(db, user.id);
    // Two months of budget + balance so the KPI row has a delta to show.
    for (const [i, m] of [
      [0, "2026-01"],
      [1, "2026-02"],
    ] as const) {
      const start = new Date(Date.UTC(2026, i, 1));
      const end = new Date(Date.UTC(2026, i, 28));
      const period = await db.financialPeriod.create({
        data: {
          userId: user.id,
          granularity: "MONTH",
          startDate: start,
          endDate: end,
          label: m,
        },
      });
      await db.financialItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "INCOME",
            label: "Salary",
            budget: 3000,
            actual: 3000,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "FIXED",
            label: "Rent",
            budget: 1200,
            actual: 1200 + i * 200,
            sortOrder: 1,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "VARIABLE",
            label: "Food",
            budget: 400,
            actual: 380 + i * 90,
            sortOrder: 2,
          },
        ],
      });
      await db.balanceItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "ASSET",
            category: "CURRENT",
            label: "Savings",
            value: 12000 + i * 1500,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "LIABILITY",
            category: "LONG_TERM",
            label: "Mortgage",
            value: 90000 - i * 500,
            sortOrder: 1,
          },
        ],
      });
    }
    await page.goto("/dashboard");

    const explainer = page.getByText("What this shows").first();
    await expect(explainer).toBeVisible();
    await expect(
      page.getByText(/Money in versus money out each month/),
    ).toBeHidden();

    await explainer.click();
    await expect(
      page.getByText(/Money in versus money out each month/),
    ).toBeVisible();
  });

  // WhenVisible used to seed its state from a browser-only global, so the
  // server rendered the charts and the client's first paint rendered the
  // placeholders — a hydration mismatch on every load.
  test("hydrates without a mismatch", async ({ page, db }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await signIn(page);
    const user = await signedInUser(db);
    // These figures are derived from the latest recorded month, so the starter
    // sheet a new account is provisioned with has to go: it is more recent than
    // the fixture below and would be the month the KPIs report on.
    await clearStarterPeriods(db, user.id);
    // Two months of budget + balance so the KPI row has a delta to show.
    for (const [i, m] of [
      [0, "2026-01"],
      [1, "2026-02"],
    ] as const) {
      const start = new Date(Date.UTC(2026, i, 1));
      const end = new Date(Date.UTC(2026, i, 28));
      const period = await db.financialPeriod.create({
        data: {
          userId: user.id,
          granularity: "MONTH",
          startDate: start,
          endDate: end,
          label: m,
        },
      });
      await db.financialItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "INCOME",
            label: "Salary",
            budget: 3000,
            actual: 3000,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "FIXED",
            label: "Rent",
            budget: 1200,
            actual: 1200 + i * 200,
            sortOrder: 1,
          },
          {
            periodId: period.id,
            type: "EXPENSE",
            category: "VARIABLE",
            label: "Food",
            budget: 400,
            actual: 380 + i * 90,
            sortOrder: 2,
          },
        ],
      });
      await db.balanceItem.createMany({
        data: [
          {
            periodId: period.id,
            type: "ASSET",
            category: "CURRENT",
            label: "Savings",
            value: 12000 + i * 1500,
            sortOrder: 0,
          },
          {
            periodId: period.id,
            type: "LIABILITY",
            category: "LONG_TERM",
            label: "Mortgage",
            value: 90000 - i * 500,
            sortOrder: 1,
          },
        ],
      });
    }
    await page.goto("/dashboard");
    await expect(page.getByText("Net worth")).toBeVisible();

    expect(errors.filter((e) => /hydration/i.test(e))).toEqual([]);
  });
});

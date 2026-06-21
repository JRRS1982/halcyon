import { expect, signIn, test } from "./_helpers/fixtures";

// Phase 1b /plan editing loop, end-to-end through the browser:
// create from seeded data → render chart + verdict + editors → edit an asset
// wrapper and an assumption (save-on-change → revalidate) → and the data-loss
// guard: clearing a required number field must revert, not persist 0.
test("plan: create, edit assumptions/assets, and the data-loss guard holds", async ({
  page,
  db,
}) => {
  await signIn(page);

  // The signed-in "/" redirects to /dashboard, which upserts the public.User
  // row (getCurrentUserSettings). Wait for that to settle BEFORE navigating
  // again, so /plan's nav isn't interrupted by the in-flight redirect and the
  // User upsert doesn't race itself.
  await page.waitForURL("**/dashboard");

  // Seed one month period with a balance ASSET + an income, so createPlan has
  // something to seed the plan from (an editable asset row + a verdict).
  const user = await db.user.findFirstOrThrow();
  const start = new Date(Date.UTC(2026, 0, 1));
  const end = new Date(Date.UTC(2026, 0, 31));
  await db.financialPeriod.create({
    data: {
      userId: user.id,
      granularity: "MONTH",
      startDate: start,
      endDate: end,
      label: "Jan 2026",
      balanceItems: {
        create: [
          {
            type: "ASSET",
            category: "LONG_TERM",
            label: "SIPP",
            value: 100000,
          },
        ],
      },
      items: {
        create: [
          {
            type: "INCOME",
            incomeCategory: "SALARY",
            label: "Salary",
            budget: 4000,
          },
        ],
      },
    },
  });

  // Now navigate to /plan (no plan yet → create form). createPlan reads the
  // seeded period on submit.
  await page.goto("/plan");
  await page.locator("input[type='date']").fill("1986-06-01");
  await page.locator("input[type='number']").first().fill("65");
  await page.getByRole("button", { name: /create my plan/i }).click();

  // Plan renders: title, verdict banner, the net-worth chart (svg), and editors.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assumptions" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();
  // Seeded asset is wrapper OTHER, so the chart's only asset segment is OTHER.
  await expect(page.locator(".recharts-legend-wrapper")).toContainText("OTHER");

  // The seeded asset row (only table on the page — no liabilities seeded).
  const assetRow = page.locator("table tbody tr").first();
  const valueCell = assetRow.locator("input[type='number']").first();
  await expect(valueCell).toHaveValue("100000");

  // Edit the wrapper OTHER → PENSION; it should stick after the server round-trip.
  const wrapper = assetRow.locator("select");
  await expect(wrapper).toHaveValue("OTHER");
  await wrapper.selectOption("PENSION");
  await expect(wrapper).toHaveValue("PENSION");
  // The edit must re-render the chart: its asset segment recolours OTHER → PENSION.
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "PENSION",
  );
  await expect(page.locator(".recharts-legend-wrapper")).not.toContainText(
    "OTHER",
  );

  // Data-loss guard: clear the required Value field and blur → it must revert
  // to the persisted value, NOT save 0.
  await valueCell.fill("");
  await valueCell.blur();
  await expect(valueCell).toHaveValue("100000");

  // Edit an assumption (save-on-change → revalidate, page still renders).
  const retirementAge = page.getByLabel(/Retirement age/i);
  await retirementAge.fill("60");
  await retirementAge.blur();
  await expect(retirementAge).toHaveValue("60");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // View switcher: Net worth (default) → Cash flow → Liquid assets.
  // Seeded plan has a SALARY income (cash-flow income bar) and a PENSION pot
  // (after the wrapper edit above), so each view has a distinctive legend entry.
  await expect(page.getByRole("button", { name: "Net worth" })).toBeVisible();

  await page.getByRole("button", { name: "Cash flow" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "SALARY",
  );
  await page.screenshot({
    path: "test-results/plan-2b-cashflow.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Liquid assets" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "PENSION",
  );
  await page.screenshot({
    path: "test-results/plan-2b-liquid.png",
    fullPage: true,
  });

  await page.screenshot({ path: "test-results/plan-1b.png", fullPage: true });
});

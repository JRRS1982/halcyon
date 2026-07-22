import { expect, signIn, test } from "./_helpers/fixtures";

// Phase 1 first-class mortgages: "Add mortgage" creates a property + mortgage
// + repayment trio and opens the shared property card (not the plain
// liability drawer) — the routing PlanView derives from linkedAssetId.
test("add a mortgage opens the property card with a mortgage section", async ({
  page,
  db,
}) => {
  await signIn(page);
  await page.waitForURL("**/dashboard");

  // createPlan seeds from the most recent month period, so give it one to
  // read (mirrors e2e/plan.spec.ts).
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

  await page.goto("/plan");
  // Wait for hydration: the "Create my plan" button stays disabled until the
  // date field's onChange sets state, which needs the client bundle attached.
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='date']").fill("1986-06-01");
  await page.locator("input[type='number']").first().fill("65");
  await page.getByRole("button", { name: /create my plan/i }).click();

  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // "Add mortgage" lives in the Liabilities card.
  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await liabilityPanel.getByRole("button", { name: "+ Add mortgage" }).click();
  await page.waitForLoadState("networkidle");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Eyebrow reads "Property" (exact — the "Mortgage"/"Property" section
  // headers below append a +/− disclosure glyph, so an exact match keeps
  // this from also matching them under Playwright's strict mode).
  await expect(dialog.getByText("Property", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^mortgage/i }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /remove mortgage/i }),
  ).toBeVisible();
});

// Phase 2 Task 5: the interest-only toggle persists (updatePlanLiability) and
// hides the editable monthly repayment once the mortgage is interest-only.
test("toggling interest-only persists after reload and hides the repayment field", async ({
  page,
  db,
}) => {
  await signIn(page);
  await page.waitForURL("**/dashboard");

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

  await page.goto("/plan");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='date']").fill("1986-06-01");
  await page.locator("input[type='number']").first().fill("65");
  await page.getByRole("button", { name: /create my plan/i }).click();

  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await liabilityPanel.getByRole("button", { name: "+ Add mortgage" }).click();
  await page.waitForLoadState("networkidle");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/repayment \/mo/i)).toBeVisible();

  const interestOnly = dialog.getByRole("checkbox", {
    name: /interest-only/i,
  });
  await expect(interestOnly).not.toBeChecked();
  await interestOnly.click();
  await expect(interestOnly).toBeChecked();
  await expect(dialog.getByLabel(/repayment \/mo/i)).not.toBeVisible();

  // Commit-on-change persists via updatePlanLiability + router.refresh(); wait
  // for that round-trip to settle before reloading, else the reload can race
  // the write and read the stale value back.
  await page.waitForLoadState("networkidle");
  await page.reload();

  // Reopen the property card via its Assets row ("New property" is the
  // default label createPlanProperty assigns).
  const assetsPanel = page.locator("section", { hasText: "Assets" });
  await assetsPanel.getByRole("button", { name: /new property/i }).click();

  const reopened = page.getByRole("dialog");
  await expect(reopened).toBeVisible();
  await expect(
    reopened.getByRole("checkbox", { name: /interest-only/i }),
  ).toBeChecked();
  await expect(reopened.getByLabel(/repayment \/mo/i)).not.toBeVisible();
});

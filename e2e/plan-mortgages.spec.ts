import {
  clearStarterPeriods,
  expect,
  openFresh,
  signIn,
  signedInUser,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Phase 1 first-class mortgages: "Add mortgage" creates a property + mortgage
// + repayment trio and opens the shared property card (not the plain
// liability drawer) — the routing PlanView derives from linkedAssetId.
test("add a mortgage opens the property card with a mortgage section", async ({
  page,
  db,
}) => {
  await signIn(page);

  // createPlan seeds from the most recent month period, so give it one to
  // read (mirrors e2e/plan.spec.ts).
  const user = await signedInUser(db);
  // A plan seeds from the most recent month period, so the starter sheet a new
  // account is provisioned with has to go — otherwise it, and not the period
  // seeded below, is what the plan is built from.
  await clearStarterPeriods(db, user.id);
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
  await page.getByRole("button", { name: /create my plan/i }).click();

  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // "Add mortgage" lives in the Liabilities card.
  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await withServerAction(page, () =>
    liabilityPanel.getByRole("button", { name: "+ Add mortgage" }).click(),
  );

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

  const user = await signedInUser(db);
  // A plan seeds from the most recent month period, so the starter sheet a new
  // account is provisioned with has to go — otherwise it, and not the period
  // seeded below, is what the plan is built from.
  await clearStarterPeriods(db, user.id);
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
  await page.getByRole("button", { name: /create my plan/i }).click();

  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await withServerAction(page, () =>
    liabilityPanel.getByRole("button", { name: "+ Add mortgage" }).click(),
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/repayment \/mo/i)).toBeVisible();

  const interestOnly = dialog.getByRole("checkbox", {
    name: /interest-only/i,
  });
  await expect(interestOnly).not.toBeChecked();
  // Commit-on-change persists via updatePlanLiability; wait for that write to
  // answer rather than for the checkbox, which flips optimistically.
  await withServerAction(page, () => interestOnly.click());
  await expect(interestOnly).toBeChecked();
  await expect(dialog.getByLabel(/repayment \/mo/i)).not.toBeVisible();

  // A fresh tab rather than page.reload(): the commit is followed by
  // router.refresh(), and reloading into that navigation is what firefox
  // reports as NS_BINDING_ABORTED (see openFresh). The write has already
  // answered, so what loads here is the persisted state.
  const fresh = await openFresh(page, "/plan");

  // Reopen the property card via its Assets row ("New property" is the
  // default label createPlanProperty assigns).
  const assetsPanel = fresh.locator("section", { hasText: "Assets" });
  await assetsPanel.getByRole("button", { name: /new property/i }).click();

  const reopened = fresh.getByRole("dialog");
  await expect(reopened).toBeVisible();
  await expect(
    reopened.getByRole("checkbox", { name: /interest-only/i }),
  ).toBeChecked();
  await expect(reopened.getByLabel(/repayment \/mo/i)).not.toBeVisible();
  await fresh.close();
});

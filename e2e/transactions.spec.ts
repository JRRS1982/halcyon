import {
  ensureTransactionsEnabled,
  expect,
  importCsv,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Signed-in transactions journey: import a CSV, categorise the row, and
// confirm it surfaces on the budget. This exercises app logic rather than
// rendering, so it runs on one browser. Each test gets a clean DB (see
// _helpers/fixtures), which means a brand-new account — and new accounts have
// transactions switched on.

test.describe("transactions journey", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  // Transactions is on for new accounts, so the enable path is no longer part
  // of the main journey — but an existing user who switched it off still meets
  // the confirm dialog, and it's the gate on a feature that changes the nav.
  test("switching the feature off and back on goes through a confirmation", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    const toggle = page.getByRole("checkbox", { name: "Transactions" });
    // New accounts start with it on.
    await expect(toggle).toBeChecked();

    // Both directions confirm first — the setting changes the nav and flips
    // the budget's actual column between computed and editable.
    await toggle.uncheck({ force: true });
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("link", { name: "Transactions" })).toBeHidden();

    await toggle.check({ force: true });
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByRole("link", { name: "Transactions" }),
    ).toBeVisible();
  });

  test("import → categorise → shows on budget", async ({ page }) => {
    const token = `${Date.now()}`;
    const account = `E2E ${token}`;
    const description = `Coffee-${token}`;
    const category = `E2ECat-${token}`;

    await signIn(page);

    await ensureTransactionsEnabled(page);

    // Import a one-row statement into a brand-new account. DMY date matches the
    // mapping's default format.
    await page.goto("/transactions");
    const csv = `date,description,amount\n05/03/2026,${description},-7.50\n`;
    await importCsv(page, csv);

    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(account);

    await page.getByRole("button", { name: /Import 1 transaction/ }).click();
    await expect(page.getByText(/Imported 1/)).toBeVisible();

    // Categorise the imported row via the combobox: type a new name → create.
    const row = page.locator("tr", { hasText: description });
    await row.getByRole("button", { name: /Uncategorized/ }).click();
    await page.getByPlaceholder("Type to search or create…").fill(category);
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Create & assign" }).click(),
    );
    // The cell updates optimistically, so this alone would not prove the write
    // landed — withServerAction above is what makes it safe to navigate.
    await expect(row.getByText(category)).toBeVisible();

    // The categorised spend surfaces on that month's budget (force-show). The
    // budget label is an editable input, so match by value.
    await page.goto("/budget?ym=2026-03");
    // The budget label is a React-controlled <input>, whose value lives on the
    // property (not the attribute), so read it live. Allow extra time for the
    // heavy budget route (first compile + force-show materialisation).
    await expect
      .poll(
        () =>
          page
            .locator("input")
            .evaluateAll(
              (els: Element[], val: string) =>
                els.some((e) => (e as HTMLInputElement).value === val),
              category,
            ),
        { timeout: 15000 },
      )
      .toBe(true);
  });
});

// DESIGN.md → Typography → Amounts: "always show the currency symbol". Editable
// cells omitted it, so a column read "£3,060" on its computed rows and "3,060"
// on the rows above them. The symbol appears when the cell is idle and steps
// aside while it is being edited, so the number the user types is the number
// the parser sees.
test.describe("amount cells", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("carry the currency symbol until focused", async ({ page }) => {
    await signIn(page);
    await page.goto("/budget");

    // The kind is chosen inside the "+ Add" drawer now, rather than from its
    // own toolbar button.
    const addDrawer = page.locator('[aria-label="Add a budget row"]');
    await expect(async () => {
      if (!(await addDrawer.isVisible())) {
        await page.getByRole("button", { name: "+ Add" }).click();
      }
      await expect(addDrawer).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await addDrawer
      .getByRole("button", { name: "Income", exact: true })
      .click();

    // Barriered: Add fires ensurePeriodForMonth and then createItem, and the
    // row is replaced by the server's when createItem answers. Typing into the
    // optimistic row before that lands has the reconcile throw the value away,
    // and the amount cell reads "" — which is exactly how this test fails under
    // load, and only under load.
    await withServerAction(page, () =>
      addDrawer.getByRole("button", { name: "Add", exact: true }).click(),
    );
    // The sheet already has the starter rows a new account is provisioned with,
    // so the row this test adds is the last one, not the first — `.first()`
    // would silently type into a starter row instead and pass for the wrong
    // reason.
    const label = page.getByPlaceholder("Name this row").last();
    await label.fill("Bonus");

    // The budget cell for the row just added.
    const amount = page.locator('input[inputmode="decimal"]').last();
    await amount.fill("3060");
    await amount.blur();

    await expect(amount).toHaveValue(/£/);
    await expect(amount).toHaveValue("£3,060");

    // Editing hands back the bare number.
    await amount.focus();
    await expect(amount).not.toHaveValue(/£/);
  });
});

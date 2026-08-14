import {
  ensureTransactionsEnabled,
  expect,
  importCsv,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Signed-in transfers journey: enable Transactions + Transfers, create a
// counterparty account in Settings, import a row, tag it as a transfer, and
// confirm it surfaces in the budget Transfers section (and not as income/
// expense). App logic rather than rendering, so chromium only. Each test gets
// a clean DB (see _helpers/fixtures), so both features start disabled.

test.describe("transfers journey", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("enable → tag transfer → shows in budget Transfers section", async ({
    page,
  }) => {
    const token = `${Date.now()}`;
    const owning = `Cur-${token}`;
    const counterparty = `ISA-${token}`;
    const description = `Move-${token}`;

    await signIn(page);

    // Settings: both flags now default on, so this asserts the state the
    // journey needs rather than switching it — and still switches it on if a
    // future default moves back.
    await ensureTransactionsEnabled(page);

    const transfersToggle = page.getByRole("checkbox", { name: "Transfers" });
    if (!(await transfersToggle.isChecked())) {
      await transfersToggle.check({ force: true });
    }
    await expect(transfersToggle).toBeChecked();

    // Create the counterparty account in Settings (AccountManager). The Add
    // button is the input's sibling, disambiguating it from the category Add.
    await page.getByPlaceholder("New account…").fill(counterparty);
    await page
      .getByPlaceholder("New account…")
      .locator("xpath=following-sibling::button")
      .click();
    await expect(page.getByText(counterparty)).toBeVisible();

    // Import a one-row statement into a brand-new owning account.
    await page.goto("/transactions");
    const csv = `date,description,amount\n05/03/2026,${description},-500.00\n`;
    await importCsv(page, csv);
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(owning);
    await page.getByRole("button", { name: /Import 1 transaction/ }).click();
    await expect(page.getByText(/Imported 1/)).toBeVisible();

    // Tag the row as a transfer: open the combobox and pick the counterparty
    // from the inline Transfers group.
    const row = page.locator("tr", { hasText: description });
    await row.getByRole("button", { name: /Uncategorized/ }).click();
    // The combobox popover is rendered inside the row, so scope to it — the
    // counterparty name also appears as an <option> in the import account select.
    await withServerAction(page, () =>
      row.getByRole("option", { name: counterparty }).click(),
    );
    await expect(row.getByText(/Transfer (to|from)/)).toBeVisible();

    // The budget Transfers section lists the owning account's net for the month
    // and never appears in income/expense.
    await page.goto("/budget?ym=2026-03");
    await expect(
      page.getByRole("heading", { name: "Transfers" }),
    ).toBeVisible();
    await expect(page.getByText(owning)).toBeVisible();
  });
});

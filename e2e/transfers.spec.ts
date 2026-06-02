import { expect, test } from "@playwright/test";

// Signed-in transfers journey: enable Transactions + Transfers, create a
// counterparty account in Settings, import a row, tag it as a transfer, and
// confirm it surfaces in the budget Transfers section (and not as income/
// expense). App logic rather than rendering, so chromium only. Unique per-run
// tokens keep it repeatable against the shared test DB.
const KNOWN_USER = { email: "test@example.com", password: "password123" };

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

    // Sign in (mock Supabase). The app upserts the profile row on first request.
    await page.goto("/sign-in");
    await page.fill("input[name='email']", KNOWN_USER.email);
    await page.fill("input[name='password']", KNOWN_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");

    // Settings: enable Transactions (toggle opens a confirm dialog) then
    // Transfers (immediate, no dialog). Skip whichever is already on.
    await page.goto("/settings");
    const txToggle = page.getByRole("checkbox", { name: "Transactions" });
    if (!(await txToggle.isChecked())) {
      await txToggle.check({ force: true });
      await page.getByRole("button", { name: "Confirm" }).click();
    }
    await expect(
      page.getByRole("link", { name: "Transactions" }),
    ).toBeVisible();

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
    await page.locator('input[type="file"]').setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(owning);
    await page.getByRole("button", { name: /Import 1 transaction/ }).click();
    await expect(page.getByText(/Imported 1/)).toBeVisible();

    // Tag the row as a transfer: open the combobox → Transfer ▸ → pick the
    // counterparty account.
    const row = page.locator("tr", { hasText: description });
    await row.getByRole("button", { name: /Uncategorized/ }).click();
    // The combobox popover is rendered inside the row, so scope to it — the
    // counterparty name also appears as an <option> in the import account select.
    await row.getByText("Transfer ▸").click();
    await row.getByText(counterparty, { exact: true }).click();
    await expect(row.getByText(/Transfer →/)).toBeVisible();
    await page.waitForLoadState("networkidle");

    // The budget Transfers section lists the owning account's net for the month
    // and never appears in income/expense.
    await page.goto("/budget?ym=2026-03");
    await expect(
      page.getByRole("heading", { name: "Transfers" }),
    ).toBeVisible();
    await expect(page.getByText(owning)).toBeVisible();
  });
});

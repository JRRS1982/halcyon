import { expect, importCsv, signIn, test } from "./_helpers/fixtures";

// Signed-in transactions journey: enable the feature, import a CSV, categorise
// the row, and confirm it surfaces on the budget. This exercises app logic
// rather than rendering, so it runs on one browser. Each test gets a clean DB
// (see _helpers/fixtures), so the feature always starts disabled.

test.describe("transactions journey", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("enable → import → categorise → shows on budget", async ({ page }) => {
    const token = `${Date.now()}`;
    const account = `E2E ${token}`;
    const description = `Coffee-${token}`;
    const category = `E2ECat-${token}`;

    await signIn(page);

    // Enable Transactions in Settings: toggling the switch opens a confirm
    // dialog; Confirm persists it. The clean-DB fixture guarantees it starts off.
    await page.goto("/settings");
    const toggle = page.getByRole("checkbox", { name: "Transactions" });
    await toggle.check({ force: true });
    await page.getByRole("button", { name: "Confirm" }).click();
    // Nav link appears once the setting is saved + revalidated.
    await expect(
      page.getByRole("link", { name: "Transactions" }),
    ).toBeVisible();

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
    await page.getByRole("button", { name: "Create & assign" }).click();
    // The row's category cell now shows the new category; let the server write
    // settle before navigating away.
    await expect(row.getByText(category)).toBeVisible();
    await page.waitForLoadState("networkidle");

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

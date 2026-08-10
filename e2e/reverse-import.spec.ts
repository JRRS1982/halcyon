import {
  ensureTransactionsEnabled,
  expect,
  importCsv,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Reversing an import removes every transaction that import created. The
// "Undo import…" dialog lists reversible batches (newest preselected) and the
// confirm soft-deletes the batch's rows.

test.describe("reverse import", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("undo import removes the imported rows", async ({ page }) => {
    const token = `${Date.now()}`;
    const account = `Rev-${token}`;
    const desc = `R-${token}`;

    await signIn(page);

    await ensureTransactionsEnabled(page);

    // Import one transaction into a fresh account.
    await page.goto("/transactions");
    const csv = `date,description,amount\n05/03/2026,${desc},-7.50\n`;
    await importCsv(page, csv, "reverse-me.csv");
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(account);
    await page.getByRole("button", { name: /Import 1 transaction/ }).click();
    await expect(page.getByText(/Imported 1/)).toBeVisible();
    await expect(page.locator("tr", { hasText: desc })).toHaveCount(1);

    // Undo it: the just-made import is preselected (newest first) and its
    // label carries the file name.
    await page.getByRole("button", { name: "Undo import…" }).click();
    const picker = page.getByLabel("Import to reverse");
    await expect(picker).toBeVisible();
    await expect(
      picker.locator("option", { hasText: "reverse-me.csv" }),
    ).toHaveCount(1);
    await withServerAction(page, () =>
      page.getByRole("button", { name: /Reverse import/ }).click(),
    );

    await expect(page.getByText(/Reversed import/)).toBeVisible();
    await expect(page.locator("tr", { hasText: desc })).toHaveCount(0);

    // The reversed batch has left the picker.
    await page.getByRole("button", { name: "Undo import…" }).click();
    await expect(page.getByText(/No reversible imports/)).toBeVisible();
  });
});

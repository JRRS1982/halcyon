import { expect, importCsv, signIn, test } from "./_helpers/fixtures";

// Regression: categorising a row while the "Uncategorized only" filter is on
// must keep the filtered view — the just-categorised row should drop out and
// stay out. The bug was that setTransactionCategory's revalidatePath re-rendered
// the page server-side with the *unfiltered* first page, and the ledger's
// re-sync effect adopted it wholesale, flashing every categorised row back in.

test.describe("ledger uncategorized filter", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("categorising under the filter keeps the categorised row hidden", async ({
    page,
  }) => {
    const token = `${Date.now()}`;
    const account = `Filt-${token}`;
    const descA = `A-${token}`;
    const descB = `B-${token}`;
    const category = `FiltCat-${token}`;

    await signIn(page);

    await page.goto("/settings");
    const txToggle = page.getByRole("checkbox", { name: "Transactions" });
    await txToggle.check({ force: true });
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByRole("link", { name: "Transactions" }),
    ).toBeVisible();

    // Import two uncategorised rows into a fresh account.
    await page.goto("/transactions");
    const csv = `date,description,amount\n05/03/2026,${descA},-7.50\n06/03/2026,${descB},-3.25\n`;
    await importCsv(page, csv);
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(account);
    await page.getByRole("button", { name: /Import 2 transaction/ }).click();
    await expect(page.getByText(/Imported 2/)).toBeVisible();

    // Reload so the import panel's preview table is gone — only the ledger
    // table remains, so the row locators below are unambiguous.
    await page.goto("/transactions");

    // Turn on the "Uncategorized only" filter — both rows are still uncategorised.
    await page
      .getByRole("checkbox", { name: "Uncategorized only" })
      .check({ force: true });
    const rowA = page.locator("tr", { hasText: descA });
    const rowB = page.locator("tr", { hasText: descB });
    await expect(rowA).toHaveCount(1);
    await expect(rowB).toHaveCount(1);

    // Categorise row A (create + assign).
    await rowA.getByRole("button", { name: /Uncategorized/ }).click();
    await page.getByPlaceholder("Type to search or create…").fill(category);
    await page.getByRole("button", { name: "Create & assign" }).click();

    // After the server revalidation settles, A must be gone (now categorised)
    // and B must remain — the filter must survive the re-render.
    await page.waitForLoadState("networkidle");
    await expect(rowB).toHaveCount(1);
    await expect(rowA).toHaveCount(0);
  });
});

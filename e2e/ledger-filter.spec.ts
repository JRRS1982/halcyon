import {
  ensureTransactionsEnabled,
  expect,
  importCsv,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

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

    await ensureTransactionsEnabled(page);

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

    // Turn on the "Uncategorized only" filter — both rows are still
    // uncategorised. It lives in the filter drawer, not the toolbar.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "Uncategorized only" })
      .check({ force: true });
    await page.getByRole("button", { name: "Apply" }).click();
    const rowA = page.locator("tr", { hasText: descA });
    const rowB = page.locator("tr", { hasText: descB });
    await expect(rowA).toHaveCount(1);
    await expect(rowB).toHaveCount(1);

    // Categorise row A (create + assign).
    await rowA.getByRole("button", { name: /Uncategorized/ }).click();
    await page.getByPlaceholder("Type to search or create…").fill(category);
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Create & assign" }).click(),
    );

    // Once the write has answered, A must be gone (now categorised) and B must
    // remain — the filter must survive the re-render.
    await expect(rowB).toHaveCount(1);
    await expect(rowA).toHaveCount(0);
  });
});

// The filter drawer, end to end: the date range and amount bounds must survive
// the round trip through the URL and the server render, and the chip that
// reports a filter must be the thing that clears it.
test.describe("ledger filter drawer", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("a date range and an amount bound narrow the ledger, and chips undo them", async ({
    page,
  }) => {
    const token = `${Date.now()}`;
    const account = `Drawer-${token}`;
    const janSmall = `JanSmall-${token}`;
    const junBig = `JunBig-${token}`;

    await signIn(page);
    await ensureTransactionsEnabled(page);

    await page.goto("/transactions");
    const csv = `date,description,amount\n10/01/2026,${janSmall},-12.00\n10/06/2026,${junBig},-900.00\n`;
    await importCsv(page, csv);
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(account);
    await page.getByRole("button", { name: /Import 2 transaction/ }).click();
    await expect(page.getByText(/Imported 2/)).toBeVisible();

    // Reload so only the ledger table remains — the import preview is gone.
    await page.goto("/transactions");
    const smallRow = page.locator("tr", { hasText: janSmall });
    const bigRow = page.locator("tr", { hasText: junBig });
    await expect(smallRow).toHaveCount(1);
    await expect(bigRow).toHaveCount(1);

    // A first-quarter date range keeps only the January row.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-01-01");
    await page.getByLabel("To", { exact: true }).fill("2026-03-31");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(smallRow).toHaveCount(1);
    await expect(bigRow).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Filters (1 active)" }),
    ).toBeVisible();

    // Clearing via the chip restores both rows.
    await page
      .getByRole("button", { name: "Remove filter: 1 Jan – 31 Mar 2026" })
      .click();
    await expect(bigRow).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Filters", exact: true }),
    ).toBeVisible();

    // Amounts match on magnitude, so a lower bound of 100 keeps the −900 row
    // and drops the −12 one.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("Minimum", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(bigRow).toHaveCount(1);
    await expect(smallRow).toHaveCount(0);
    await expect(page.getByText("Amount 100.00+")).toBeVisible();
  });
});

// The controls card and the table's total row: the two things a user reads to
// know what they are looking at. The total must net the rows on screen, and
// the card must hand the search box over to categorising on a selection.
test.describe("ledger controls card and total row", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("the total nets the filtered rows, and selecting swaps search for categorize", async ({
    page,
  }) => {
    const token = `${Date.now()}`;
    const account = `Total-${token}`;
    const small = `Small-${token}`;
    const big = `Big-${token}`;

    await signIn(page);
    await ensureTransactionsEnabled(page);

    await page.goto("/transactions");
    const csv = `date,description,amount\n10/01/2026,${small},-12.00\n10/06/2026,${big},-900.00\n`;
    await importCsv(page, csv);
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(account);
    await page.getByRole("button", { name: /Import 2 transaction/ }).click();
    await expect(page.getByText(/Imported 2/)).toBeVisible();

    await page.goto("/transactions");

    // Filtering to the January row alone must move the total with it, not
    // leave it reporting the unfiltered ledger.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-01-01");
    await page.getByLabel("To", { exact: true }).fill("2026-03-31");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.locator("tfoot")).toContainText("-12.00");
    await expect(page.locator("tfoot")).toContainText("Total · 1 transaction");

    // Selecting a row hands the search box's slot to the categorize control.
    await expect(page.getByPlaceholder("Search description…")).toBeVisible();
    await page.getByRole("checkbox", { name: `Select ${small}` }).check();

    await expect(page.getByText("1 selected")).toBeVisible();
    await expect(page.getByPlaceholder("Search description…")).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: "Set category for selected transactions",
      }),
    ).toBeVisible();

    // Clearing gives the search box back.
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByPlaceholder("Search description…")).toBeVisible();
  });
});

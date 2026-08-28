// e2e/mobile-sheet.spec.ts
//
// The budget and balance sheets are fixed-column grids that used to be clipped
// by `overflow: hidden` on a phone — the amount columns were simply
// unreachable. The columns now narrow enough that all three fit an ordinary
// phone, and below the row's floor the sheet pans with the label column pinned
// left. Only a real viewport can tell us either of those worked.
import type { Page } from "@playwright/test";
import { expect, signIn, test, withServerAction } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };
// Narrower than the row's 320px floor plus the page's gutters, so the sheet
// still has somewhere to pan to.
const NARROW_PHONE = { width: 320, height: 720 };

// The budget's four add buttons became one "+ Add" whose drawer picks the
// kind, so adding a row is open → choose → confirm rather than a single click.
//
// The open is retried like fixtures' openAddDrawer and mobile-nav's openMenu:
// the sheet is server-rendered, so the button is clickable before React
// attaches its handler and the first click is swallowed with no error. The
// confirm is barriered because it fires ensurePeriodForMonth and then
// createItem, and these tests measure the row the server sends back.
async function addExpenseRow(page: Page) {
  const drawer = page.locator('[aria-label="Add a budget row"]');
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await page.getByRole("button", { name: "+ Add" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // Expense is the drawer's default kind, so its sections are already on
  // screen — choosing one adds the row, with no confirm step.
  await withServerAction(page, () =>
    drawer.getByRole("button", { name: "Fixed", exact: true }).click(),
  );
}

test.describe("Sheets on a phone", () => {
  test.use({ viewport: PHONE });

  test("the whole budget sheet fits the viewport, Actual included", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");

    // Add a row so the sheet has an item to measure against.
    await addExpenseRow(page);

    const sheet = page.locator("[data-sheet-scroller]");
    await expect(sheet).toBeVisible();

    // Nothing to pan to: the three columns are the container's full width.
    const { scrollWidth, clientWidth } = await sheet.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBe(clientWidth);

    // The rightmost column is the one that used to sit off-screen, so measure
    // it rather than trusting the container's own width.
    const actual = page.getByText("Actual", { exact: true }).first();
    const box = await actual.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width);
  });

  test("row tools stay out of the toolbar until a row is focused", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");

    // At rest the delete tool would only ever be disabled, so on a phone it
    // is not in the toolbar at all.
    const deleteRow = page.getByRole("button", { name: /delete row/i });
    await expect(deleteRow).toBeHidden();

    // Adding a row focuses it, and the row-scoped tools appear with it.
    await addExpenseRow(page);
    await expect(deleteRow).toBeVisible();
  });

  test("the page itself never scrolls horizontally", async ({ page }) => {
    await signIn(page);

    for (const path of [
      "/budget",
      "/balance",
      "/dashboard",
      "/settings",
      "/transactions",
      "/guide",
    ]) {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${path} overflows the viewport`).toBe(false);
    }
  });
});

test.describe("Sheets on a viewport narrower than the row floor", () => {
  test.use({ viewport: NARROW_PHONE });

  test("the budget sheet pans horizontally with the category column pinned", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");
    await addExpenseRow(page);

    const sheet = page.locator("[data-sheet-scroller]");
    const { scrollWidth, clientWidth } = await sheet.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    // The category header stays put while the amounts scroll under it.
    const category = page.getByText("Category", { exact: true }).first();
    const before = await category.boundingBox();
    await sheet.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const after = await category.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
  });
});

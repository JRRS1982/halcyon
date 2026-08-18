// e2e/mobile-sheet.spec.ts
//
// The budget and balance sheets are fixed-column grids that used to be clipped
// by `overflow: hidden` on a phone — the amount columns were simply
// unreachable. They now pan inside the sheet container with the label column
// pinned left. Only a real viewport can tell us that worked.
import { expect, signIn, test } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };

test.describe("Sheets on a phone", () => {
  test.use({ viewport: PHONE });

  test("the budget sheet pans horizontally with the category column pinned", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");

    // Add a row so the sheet has an item to measure against.
    await page.getByRole("button", { name: /\+ expense/i }).click();

    const sheet = page.locator("[data-sheet-scroller]");
    await expect(sheet).toBeVisible();

    // The grid is wider than the viewport, so the container is scrollable...
    const { scrollWidth, clientWidth } = await sheet.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    // ...and the category header stays put while the amounts scroll under it.
    const category = page.getByText("Category", { exact: true }).first();
    const before = await category.boundingBox();
    await sheet.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const after = await category.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
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
    await page.getByRole("button", { name: /\+ expense/i }).click();
    await expect(deleteRow).toBeVisible();
  });

  test("the page itself never scrolls horizontally", async ({ page }) => {
    await signIn(page);

    for (const path of ["/budget", "/balance", "/dashboard", "/settings"]) {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${path} overflows the viewport`).toBe(false);
    }
  });
});

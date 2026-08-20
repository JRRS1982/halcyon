// e2e/mobile-ledger.spec.ts
//
// The ledger table pans horizontally on a phone with the selection column
// pinned left — the bulk workflow needs the checkboxes in view while the
// category column is reached by panning (the same treatment the budget and
// balance sheets get, see mobile-sheet.spec.ts). Layout-only, so it runs on
// every engine; the rows are seeded straight into the database rather than
// through the import journey.
import { expect, signedInUser, signIn, test } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };

test.describe("Ledger on a phone", () => {
  test.use({ viewport: PHONE });

  test("the table pans with the selection checkboxes pinned", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);

    const account = await db.account.create({
      data: { userId: user.id, name: "Current Account" },
    });
    await db.transaction.createMany({
      data: [
        {
          userId: user.id,
          accountId: account.id,
          date: new Date("2026-03-05"),
          amount: -42.5,
          description: "Supermarket weekly shop",
        },
        {
          userId: user.id,
          accountId: account.id,
          date: new Date("2026-03-06"),
          amount: -9.8,
          description: "Coffee and pastry",
        },
      ],
    });

    await page.goto("/transactions");

    const scroller = page.locator("[data-ledger-scroller]");
    await expect(scroller).toBeVisible();

    // The table is wider than the phone, so the container is scrollable...
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    // ...and the row's checkbox stays put while the columns slide under it.
    const checkbox = page.getByRole("checkbox", {
      name: "Select Supermarket weekly shop",
    });
    const before = await checkbox.boundingBox();
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const panned = await scroller.evaluate((el) => el.scrollLeft);
    expect(panned).toBeGreaterThan(0);
    const after = await checkbox.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);

    // The notes spacer header (the other narrow non-sorting cell) must NOT
    // have followed the checkboxes to the left edge — it is the table's last
    // column, so at full pan it sits on the right half of the screen.
    const notesBox = await page.locator('th[aria-label="Notes"]').boundingBox();
    expect(notesBox?.x ?? Number.NaN).toBeGreaterThan(clientWidth / 2);
  });
});

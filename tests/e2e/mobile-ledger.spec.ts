// tests/e2e/mobile-ledger.spec.ts
//
// On a phone the ledger reads as statement lines rather than a panning table:
// each row's amount and category picker sit on screen with its checkbox, so a
// user can review and categorise without scrolling sideways. Layout-only, so
// it runs on every engine; the rows are seeded straight into the database
// rather than through the import journey.
import { buildAccountData } from "@/lib/accounts/creation";
import { expect, signedInUser, signIn, test } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };

test.describe("Ledger on a phone", () => {
  test.use({ viewport: PHONE });

  test("every row's amount and category are on screen, with no sideways scroll", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);

    const account = await db.account.create({
      data: {
        userId: user.id,
        name: "Current Account",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
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

    // Nothing to pan to: the lines fit the phone.
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // The row's checkbox, its amount and its category picker are all inside
    // the viewport at once.
    const row = page
      .getByRole("row")
      .filter({ hasText: "Supermarket weekly shop" });
    for (const part of [
      row.getByRole("checkbox", { name: "Select Supermarket weekly shop" }),
      // The amount in the default money format (no decimals).
      row.getByText(/£4[23]$/),
      row.getByRole("button", { name: /Uncategori[sz]ed/ }),
    ]) {
      const box = await part.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        PHONE.width,
      );
    }
  });
});

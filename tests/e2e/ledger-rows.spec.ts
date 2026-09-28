// e2e/ledger-rows.spec.ts
//
// Two things about a ledger row that only the rendered table can answer: that
// clicking the row selects it, and that opening a row's details leaves every
// column exactly where it was. Both are layout/local-state only — no server
// action — so they run on every engine.
import { buildAccountData } from "@/lib/accounts/creation";
import { expect, signedInUser, signIn, test } from "./_helpers/fixtures";

// The kept import columns of a real bank statement. The count and the width
// matter: this is what the detail panel puts on one line, and it is what used
// to bully the seven columns above it into new widths.
const EXTRA = {
  NAME: "M&S",
  TIME: "11:38:20",
  TYPE: "Card payment",
  ADDRESS: "Gallaghers Retail Park",
  CATEGORY: "Gifts",
  CURRENCY: "GBP",
  "MONEY OUT": "-29.85",
  "LOCAL AMOUNT": "-29.85",
  "LOCAL CURRENCY": "GBP",
  "TRANSACTION ID": "tx_0000B7n5KXJVkI54mBd5b1",
};

test.describe("Ledger rows", () => {
  test.beforeEach(async ({ page, db }) => {
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
          date: new Date("2026-06-28"),
          amount: -29.85,
          description: "Supermarket weekly shop",
          extra: EXTRA,
        },
        {
          userId: user.id,
          accountId: account.id,
          date: new Date("2026-06-27"),
          amount: -5.4,
          description: "Coffee and pastry",
        },
      ],
    });
    await page.goto("/transactions");
  });

  // The checkbox is a 13px target in a row the user is already pointing at.
  test("a click on the row body selects it, and the checkbox still toggles once", async ({
    page,
  }) => {
    const box = page.getByRole("checkbox", {
      name: "Select Supermarket weekly shop",
    });
    await expect(box).not.toBeChecked();

    await page.getByText("Supermarket weekly shop").click();
    await expect(box).toBeChecked();

    // The row handler must not also fire for a click on the checkbox itself —
    // two toggles in one gesture cancel out and the row never selects.
    await box.click();
    await expect(box).not.toBeChecked();
  });

  test("opening a row's details moves no column", async ({ page }) => {
    const headers = page.locator("thead th");
    const details = page.getByRole("button", { name: /details/i }).first();
    await expect(details).toBeVisible();

    const columnWidths = () =>
      headers.evaluateAll((cells) =>
        cells.map((cell) => Math.round(cell.getBoundingClientRect().width)),
      );

    const before = await columnWidths();
    await details.click();
    await expect(page.getByText("Gallaghers Retail Park")).toBeVisible();

    // The detail row spans all seven columns. Under auto table layout its own
    // content width was thrown into the column algorithm, so expanding a row
    // re-measured the whole table and every row below it jumped sideways.
    expect(await columnWidths()).toEqual(before);
  });
});

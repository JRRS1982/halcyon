// e2e/balance-accounts.spec.ts
//
// Server-action journeys for the unified-accounts work: adding an account
// (plain and property+mortgage), archiving one ("stop tracking"), the app's
// one hard-delete path ("delete it everywhere"), a value-less account still
// listing itself, a rename following its account onto the budget's anchored
// row, and — since account-terms (Task 7) moved the row's identity and
// projection terms into a re-openable card — setting and later changing a
// term through that card. Chromium-only — see the beforeEach skip below.

import type { Page } from "@playwright/test";
import {
  balanceRow,
  balanceRowButton,
  clearStarterPeriods,
  expect,
  openAccountCard,
  openAddDrawer,
  rowInput,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

/**
 * Focuses a row by clicking its value cell, so the toolbar's row-scoped
 * "Delete row" button becomes enabled.
 *
 * The sheet is a spreadsheet, not a list with a per-row delete control: a
 * cell must be focused first (BalanceSheet.tsx's onDelete reads
 * focusedCell), and focus is only wired once React has hydrated that row's
 * input — hence the same retry-until-enabled shape as openAddDrawer. The
 * value cell, not the name — the name is a button now (it opens AccountCard,
 * which this helper has no need of).
 */
async function focusRowByName(page: Page, name: string): Promise<void> {
  const cell = balanceRow(page, name).locator("input").first();
  const deleteRowButton = page.getByRole("button", { name: /delete row/i });
  await expect(async () => {
    await cell.click();
    await expect(deleteRowButton).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("balance accounts", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Server-action journey: the same server code through three engines tests it three times.",
    );
  });

  test("adding an asset creates the account and its first value", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
    await page.getByLabel(/name/i).fill("Vanguard ISA");
    await page.getByLabel(/section/i).selectOption("LONG_TERM");
    await page.getByLabel(/value now/i).fill("42300");

    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );

    await expect(balanceRowButton(page, "Vanguard ISA")).toBeVisible();
  });

  test("a property with a mortgage creates both sides", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("PROPERTY");
    await page.getByLabel(/name/i).fill("Home");
    await page.getByLabel(/section/i).selectOption("PROPERTY");
    // Two fields match /value now/i once the mortgage branch is open (the
    // property's own "Value now" and the mortgage's "Mortgage value now"),
    // so the property's field needs an exact match.
    await page.getByLabel("Value now", { exact: true }).fill("420000");
    await page.getByLabel(/is there a mortgage/i).check();
    await page.getByLabel(/mortgage name/i).fill("Halifax mortgage");
    await page.getByLabel(/mortgage value now/i).fill("184200");

    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );

    await expect(balanceRowButton(page, "Home")).toBeVisible();
    await expect(balanceRowButton(page, "Halifax mortgage")).toBeVisible();
  });

  // The brief called this "removes it from the sheet", but the built
  // archiveAccount only flips Account.deletedAt — it deliberately leaves
  // every recorded BalanceItem (including this period's) untouched ("every
  // observation already recorded stays exactly where it is",
  // accountActions.ts). The account stops being offered for new months and
  // shows up under Settings → Archived; it does not vanish from a month
  // that already recorded it. Asserting against the built behaviour instead
  // of the brief's title.
  test("stop tracking moves the account into the Settings archive", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("SAVINGS");
    await page.getByLabel(/name/i).fill("Premium bonds");
    await page.getByLabel(/section/i).selectOption("MEDIUM_TERM");
    await page.getByLabel(/value now/i).fill("5000");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );

    await focusRowByName(page, "Premium bonds");
    await page.getByRole("button", { name: /delete row/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: /stop tracking/i }),
    ).toBeChecked();

    await withServerAction(page, () =>
      dialog.getByRole("button", { name: /^delete$/i }).click(),
    );

    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /archived/i }),
    ).toBeVisible();
    // page.getByText("Premium bonds") alone would match the *active*
    // accounts list just as happily — it would pass even if archiveAccount
    // did nothing. Only an archived row offers a "Restore" button, so
    // require both in the same row to actually pin the archive having
    // happened.
    const archivedRow = page
      .locator("div")
      .filter({ hasText: "Premium bonds" })
      .filter({ has: page.getByRole("button", { name: "Restore" }) })
      .last();
    await expect(archivedRow).toBeVisible();
  });

  // The brief omitted this: "delete it everywhere" is the app's one hard
  // delete (everything else soft-deletes), gated on typing DELETE, and
  // nothing else exercises it in a browser.
  test("deleting everywhere removes the account for good", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
    await page.getByLabel(/name/i).fill("Crypto wallet");
    await page.getByLabel(/section/i).selectOption("OTHER");
    await page.getByLabel(/value now/i).fill("1000");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );

    await focusRowByName(page, "Crypto wallet");
    await page.getByRole("button", { name: /delete row/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /delete it everywhere/i }).check();
    await dialog.getByLabel(/type delete to confirm/i).fill("DELETE");

    await withServerAction(page, () =>
      dialog.getByRole("button", { name: /^delete$/i }).click(),
    );

    await expect(balanceRowButton(page, "Crypto wallet")).toHaveCount(0);
  });

  // page.tsx lists every live account on every month, left-joining this
  // month's observation onto it — an account is a row from the moment it
  // exists, whether or not this month has recorded a value for it. Deleting
  // the six starter accounts first keeps the count exactly 1: they carry no
  // value either, and would otherwise inflate the footer's tally.
  test("an account with no value is listed and counted in the footer", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await db.account.deleteMany({ where: { userId: user.id } });
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
    await page.getByLabel(/name/i).fill("Vanguard ISA");
    await page.getByLabel(/section/i).selectOption("LONG_TERM");
    await page.getByLabel(/value now/i).fill("42300");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );
    await expect(balanceRowButton(page, "Vanguard ISA")).toBeVisible();

    // A month nothing has recorded yet: the account still gets a row, blank
    // rather than absent. copy-forward is an explicit action (copyRows.ts),
    // never automatic on navigation, so this month stays empty.
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const ym = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    await page.goto(`/balance?ym=${ym}`);

    await expect(balanceRowButton(page, "Vanguard ISA")).toBeVisible();
    const row = balanceRow(page, "Vanguard ISA");
    await expect(row.locator('input[inputmode="decimal"]')).toHaveValue("");
    await expect(
      page.getByText("1 account without a value", { exact: true }),
    ).toBeVisible();
  });

  // BudgetSheet.tsx makes an anchored row's label cell read-only — the name
  // comes from the account, not a value the row can diverge on — so the only
  // way it changes is renameAccount's own propagation to BudgetItem.label
  // (accountActions.ts). This drives that rename through AccountCard, which
  // now owns the name field, rather than calling the server action directly.
  test("renaming through the card renames the budget's anchored row", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
    await page.getByLabel(/name/i).fill("Vanguard ISA");
    await page.getByLabel(/section/i).selectOption("LONG_TERM");
    await page.getByLabel(/value now/i).fill("42300");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );
    await expect(balanceRowButton(page, "Vanguard ISA")).toBeVisible();

    const account = await db.account.findFirstOrThrow({
      where: { userId: user.id, name: "Vanguard ISA" },
    });
    const period = await db.financialPeriod.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Vanguard ISA",
        budget: 500,
      },
    });

    await openAccountCard(page, "Vanguard ISA");
    const nameField = page.getByLabel("Name");
    await withServerAction(page, async () => {
      await nameField.fill("Vanguard S&S ISA");
      await nameField.blur();
    });

    await page.goto("/budget");
    await expect(rowInput(page, "Vanguard S&S ISA")).toBeVisible();
  });

  // New surface this task adds: the card owns projection terms too, not just
  // identity. Set at creation through the Add drawer's own Advanced section,
  // then changed later through the re-opened card, and durable across a
  // reload — proving the write actually reached the server rather than only
  // ever having been the client's optimistic value.
  test("a term set when adding an account persists, and a rate changed through the card survives a reload", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await page.goto("/balance");

    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("SAVINGS");
    await page.getByLabel(/name/i).fill("Marcus savings");
    await page.getByLabel(/section/i).selectOption("MEDIUM_TERM");
    await page.getByLabel(/value now/i).fill("10000");
    await page.getByRole("button", { name: /advanced/i }).click();
    await page.getByLabel(/expected growth/i).fill("2.5");

    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );
    await expect(balanceRowButton(page, "Marcus savings")).toBeVisible();

    // The card's own Advanced section is open by default (unlike the Add
    // drawer's) — the rate the account was created with should already be on
    // screen, with nothing to expand first.
    await openAccountCard(page, "Marcus savings");
    const rateField = page.getByLabel(/expected growth/i);
    await expect(rateField).toHaveValue("2.5");

    await withServerAction(page, async () => {
      await rateField.fill("3.1");
      await rateField.blur();
    });

    await page.reload();
    await openAccountCard(page, "Marcus savings");
    await expect(page.getByLabel(/expected growth/i)).toHaveValue("3.1");
  });
});

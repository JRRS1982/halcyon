// e2e/balance-accounts.spec.ts
//
// Server-action journeys for the unified-accounts work: adding an account
// (plain and property+mortgage), archiving one ("stop tracking"), and the
// app's one hard-delete path ("delete it everywhere"). Chromium-only — see
// the beforeEach skip below.

import type { Page } from "@playwright/test";
import {
  clearStarterPeriods,
  expect,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

/**
 * The sheet's editable cells (BalanceSheet.tsx's CellInput) are bare
 * `<input>`s with no associated label — their value is the row's name, not
 * an accessible name Playwright can query by role. React sets a freshly
 * mounted controlled input's value via the DOM `defaultValue` IDL property,
 * which does reflect the `value` content attribute, so a plain attribute
 * selector finds a row by the name it was created with.
 */
function rowInput(page: Page, name: string) {
  return page.locator(`input[value="${name}"]`);
}

/**
 * Opens the "+ Add" drawer, re-clicking if the first click didn't take.
 *
 * Mirrors mobile-nav.spec.ts's openMenu: a click landing before hydration is
 * swallowed by a button with no handler yet. Retrying while the drawer is
 * still closed converges once hydration catches up, without a fixed sleep.
 */
async function openAddDrawer(page: Page): Promise<void> {
  const title = page.getByRole("heading", { name: "Add an account" });
  await expect(async () => {
    if (!(await title.isVisible())) {
      await page.getByRole("button", { name: "+ Add" }).click();
    }
    await expect(title).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Focuses a row by clicking the cell holding its name, so the toolbar's
 * row-scoped "Delete row" button becomes enabled.
 *
 * The sheet is a spreadsheet, not a list with a per-row delete control: a
 * cell must be focused first (BalanceSheet.tsx's onDelete reads
 * focusedCell), and focus is only wired once React has hydrated that row's
 * input — hence the same retry-until-enabled shape as openAddDrawer.
 */
async function focusRowByName(page: Page, name: string): Promise<void> {
  const cell = rowInput(page, name);
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

    await expect(rowInput(page, "Vanguard ISA")).toBeVisible();
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

    await expect(rowInput(page, "Home")).toBeVisible();
    await expect(rowInput(page, "Halifax mortgage")).toBeVisible();
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

    await expect(rowInput(page, "Crypto wallet")).toHaveCount(0);
  });
});

// e2e/plan-sync.spec.ts
//
// The Sync journey: a plan built from the balance sheet, the sheet moving
// underneath it, and one button putting the two back in step — plus the one
// destructive path, where a row that exists only in the plan gets a
// confirmation before Sync throws it away. Chromium-only, see the beforeEach
// skip below.

import type { Page } from "@playwright/test";
import {
  addPlanAsset,
  clearStarterPeriods,
  createPlanWithDob,
  expect,
  openAddDrawer,
  rowInput,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

const ACCOUNT = "Vanguard ISA";

/**
 * Adds the ISA through the balance sheet's Add drawer, the way a user does.
 *
 * Deliberately not a Prisma insert: the account and its first observed value
 * are what a plan is built from, and creating them through the drawer is the
 * only thing that proves the two halves of the feature meet.
 */
async function addIsa(page: Page): Promise<void> {
  await page.goto("/balance");
  await openAddDrawer(page);
  await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
  await page.getByLabel(/name/i).fill(ACCOUNT);
  await page.getByLabel(/section/i).selectOption("LONG_TERM");
  await page.getByLabel(/value now/i).fill("42300");

  await withServerAction(page, () =>
    page.getByRole("button", { name: /^add$/i }).click(),
  );

  await expect(rowInput(page, ACCOUNT)).toBeVisible();
}

/**
 * Waits until /plan has hydrated, then returns the Assets card.
 *
 * The chart is a recharts ResponsiveContainer, which renders nothing until it
 * has measured itself in the browser — so its surface existing is proof React
 * has mounted. That matters before pressing Sync: a server-rendered button is
 * clickable before its handler is attached, and the click is swallowed with no
 * error anywhere.
 */
async function planAssets(page: Page) {
  await expect(page.locator(".recharts-surface").first()).toBeVisible({
    timeout: 15_000,
  });
  return page.locator("section", { hasText: "Assets" });
}

test.describe("plan sync", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Server-action journey: the same server code through three engines tests it three times.",
    );
  });

  test("an edited balance marks the plan row, and Sync brings it up to date", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);

    await addIsa(page);

    await page.goto("/plan");
    await createPlanWithDob(page);

    // A new plan is a sync against an empty one, so the account is already a
    // row — carrying the value the sheet recorded, and nothing to do.
    const assets = await planAssets(page);
    const isa = assets.getByRole("button", { name: new RegExp(ACCOUNT) });
    await expect(isa).toContainText("£42,300");
    await expect(isa.getByRole("img", { name: /^synced/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /up to date/i }),
    ).toBeDisabled();

    // Move the balance sheet underneath the plan.
    await page.goto("/balance");
    const sheetRow = page
      .locator('[role="row"]')
      .filter({ has: rowInput(page, ACCOUNT) });
    // Second cell of the row: name, value, notes. The cells carry no labels —
    // see rowInput's note on why the row is found by its name cell's value.
    const valueCell = sheetRow.locator("input").nth(1);
    // The formatted value is what an idle, hydrated cell shows; typing before
    // that is typing into an input React is about to reconcile.
    await expect(valueCell).toHaveValue("£42,300");
    // Focus and the raw digits, before filling. Focusing swaps the cell's
    // value from "£42,300" to "42300" (AmountInput hands the user the bare
    // number to edit), and fill()'s select-all is undone by the re-render that
    // swap causes — so filling in one go appends rather than replaces, and the
    // plan reads £4,230,051,000.
    await valueCell.click();
    await expect(valueCell).toHaveValue("42300");
    await withServerAction(page, async () => {
      await valueCell.fill("51000");
      await valueCell.blur();
    });

    // The plan still holds the old figure, and now says so: the marker flags
    // the row and the balance sheet's figure sits beside it, so the user can
    // see what Sync would write before pressing anything.
    await page.goto("/plan");
    const changedAssets = await planAssets(page);
    const changedIsa = changedAssets.getByRole("button", {
      name: new RegExp(ACCOUNT),
    });
    await expect(
      changedIsa.getByRole("img", { name: /^changed/i }),
    ).toBeVisible();
    await expect(changedIsa).toContainText("£42,300");
    await expect(changedIsa).toContainText("£51,000");

    const sync = page.getByRole("button", { name: /sync with latest/i });
    await expect(sync).toHaveText(/1 change$/);
    await expect(page.getByText("1 updated")).toBeVisible();

    await withServerAction(page, () => sync.click());

    // One press, and the plan holds the sheet's figure with nothing left to do.
    await expect(changedIsa).toContainText("£51,000");
    await expect(
      changedIsa.getByRole("img", { name: /^synced/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /up to date/i }),
    ).toBeDisabled();
  });

  test("Sync confirms before removing a plan-only row, and Cancel changes nothing", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);

    await addIsa(page);

    await page.goto("/plan");
    await createPlanWithDob(page);

    // "+ Add asset" invents a row with no account behind it — the one thing
    // Sync destroys rather than overwrites, and the reason a confirmation
    // exists at all. Its drawer opens on creation; Escape closes it.
    const assets = await planAssets(page);
    // Named to match the row locators below: this asset exists only in the
    // plan, with no account behind it.
    await addPlanAsset(page, { name: "New asset", value: "0" });
    // Wait for the drawer to actually be open before closing it, rather than
    // pressing Escape into a page that has not opened it yet.
    //
    // AssetsTable.add() awaits createPlanAsset, fires router.refresh() without
    // awaiting it, then selects the new id — and PlanView only renders the
    // drawer once that id is found in `plan.assets`, which needs the refresh to
    // have landed. withServerAction cannot cover the gap: it counts POSTs
    // carrying `next-action`, and a refresh is a GET with `rsc: 1`. So an
    // Escape sent in that window closes nothing, the assertion below passes on
    // a drawer that was never open, and the drawer then opens behind the test —
    // leaving its scrim to swallow the Sync click 30s later. Load-dependent,
    // which is why it passes alone and fails in a full run.
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();

    const invented = assets.getByRole("button", { name: /New asset/ });
    await expect(
      invented.getByRole("img", { name: /^plan only/i }),
    ).toBeVisible();

    const sync = page.getByRole("button", { name: /sync with latest/i });
    await expect(sync).toHaveText(/1 change$/);
    await sync.click();

    // Named, not counted: a count alone can't tell scratch work from an
    // evening's scenario.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /remove 1 plan-only row/i }),
    ).toBeVisible();
    await expect(dialog.getByText("New asset")).toBeVisible();

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    // Nothing was written: the invented row is still there, the button still
    // offers the same change, and the synced row is untouched.
    await expect(invented).toBeVisible();
    await expect(sync).toHaveText(/1 change$/);
    await expect(
      assets.getByRole("button", { name: new RegExp(ACCOUNT) }),
    ).toContainText("£42,300");
  });
});

// e2e/budget-transfers.spec.ts
//
// The budget's two account-keyed kinds, end to end.
//
// This replaces e2e/transfers.spec.ts, whose journey no longer exists:
// tagging a transaction as a transfer used to conjure a row in a Transfers
// *panel*, and that panel is gone. A transfer is now a row the user
// deliberately adds against an ASSET account; a tagged transaction fills that
// row's **actual** rather than creating anything. A repayment is the same
// shape against a LIABILITY account, and renders inside Expenses.
//
// Both tests are server-action journeys ending in a Prisma write, so both are
// chromium-gated per the repo's browser-coverage rule. Section *placement* is
// asserted through the section totals rather than through DOM order: a total
// that moves is the behaviour, and it keeps this file free of any structural
// claim that a non-chromium engine could regress unseen.

import type { Page } from "@playwright/test";
import {
  clearStarterPeriods,
  createPlanWithDob,
  ensureTransactionsEnabled,
  expect,
  importCsv,
  openAddDrawer,
  rowInput,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

const ISA = "Vanguard ISA";
const MORTGAGE = "Halifax mortgage";

/**
 * The budget sheet's table, and one of its rows by the label its rowheader
 * carries.
 *
 * Section bands, section subheads and the grand total are all `role="row"`
 * with a `rowheader` naming them (src/components/sheet/SheetRow), so one
 * helper reaches all three. `exact` because "Income" is also a substring of
 * "Side income" — but a section subhead carries its info button's "i" as well,
 * so those callers pass exact: false.
 */
function sheetOf(page: Page) {
  return page.getByRole("table", { name: "Budget" });
}

function bandRow(page: Page, label: string, exact = true) {
  return (
    sheetOf(page)
      .getByRole("row")
      // Page-rooted, not sheet-rooted: `filter({ has })` re-queries the inner
      // locator relative to each candidate row, so a sheet-rooted one would
      // look for the table *inside* the row and match nothing.
      .filter({ has: page.getByRole("rowheader", { name: label, exact }) })
  );
}

// A band's Budget cell, then its Actual cell: the rowheader is a different
// role, so the two amounts are the row's only cells.
const budgetCell = (row: ReturnType<typeof bandRow>) =>
  row.getByRole("cell").first();
const actualCell = (row: ReturnType<typeof bandRow>) =>
  row.getByRole("cell").nth(1);

/**
 * Opens the toolbar's "+ Add" drawer and picks a kind, re-clicking if the
 * first click didn't take.
 *
 * Same shape as fixtures' openAddDrawer and mobile-nav's openMenu: the sheet
 * is server-rendered, so the button is clickable before React attaches its
 * handler and the first click is swallowed with no error anywhere. Retrying
 * while the drawer is still closed converges as soon as hydration catches up,
 * without a fixed sleep.
 *
 * The kind is the drawer's first field now, rather than one toolbar button
 * per kind, so opening and choosing are two steps.
 */
async function openAnchoredDrawer(page: Page, kind: "Transfer" | "Repayment") {
  const drawer = page.locator('[aria-label="Add a budget row"]');
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await page.getByRole("button", { name: "+ Add" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await drawer.getByRole("button", { name: kind, exact: true }).click();
  return drawer;
}

/**
 * Types an amount into a row's Budget cell and waits for the write.
 *
 * The cell is an AmountInput: it shows "" at zero and hands the user the bare
 * number on focus, so filling an untouched row is a plain fill with no
 * select-all race (unlike the balance sheet's, which is pre-filled). The save
 * is debounced by 500ms, which is why the fill has to sit inside
 * withServerAction rather than being followed by one.
 */
async function budgetRow(page: Page, name: string, amount: string) {
  const row = sheetOf(page)
    .getByRole("row")
    .filter({ has: rowInput(page, name) });
  // The label input, then the Budget AmountInput. The Actual column is static
  // text while transactions mode is on, so there is no third input.
  const cell = row.locator("input").nth(1);
  await cell.click();
  await withServerAction(page, async () => {
    await cell.fill(amount);
    await cell.blur();
  });
  return row;
}

test.describe("budget transfers and repayments", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Server-action journey: the same server code through three engines tests it three times.",
    );
  });

  test("a budgeted transfer sits in Transfers, and a tagged transaction fills its actual", async ({
    page,
    db,
  }) => {
    const token = `${Date.now()}`;
    const owning = `Cur-${token}`;
    const description = `Move-${token}`;

    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);

    // Both flags default on, so this asserts the state the journey needs
    // rather than switching it — and still switches it on if a future default
    // moves back.
    await ensureTransactionsEnabled(page);
    const transfersToggle = page.getByRole("checkbox", {
      name: "Transfers and saving",
    });
    if (!(await transfersToggle.isChecked())) {
      await transfersToggle.check({ force: true });
    }
    await expect(transfersToggle).toBeChecked();

    // Onboarding already seeds six ASSET accounts eligible to anchor a
    // transfer, one of them named plain "ISA" — so this step isn't about
    // eligibility, it's about giving the drawer and picker an exact-match
    // name ("Vanguard ISA") that can't collide with that default account.
    await page.goto("/balance");
    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("STOCKS_ISA");
    await page.getByLabel(/name/i).fill(ISA);
    await page.getByLabel(/section/i).selectOption("LONG_TERM");
    await page.getByLabel(/value now/i).fill("42300");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );
    await expect(rowInput(page, ISA)).toBeVisible();

    // Budget £500/mo into it. The direction is stated from the user's side:
    // "To Vanguard ISA", never the stored INFLOW.
    await page.goto("/budget?ym=2026-03");
    const drawer = await openAnchoredDrawer(page, "Transfers and saving");
    await drawer.getByRole("button", { name: ISA, exact: true }).click();
    await drawer.getByRole("button", { name: `To ${ISA}` }).click();
    // The drawer asks for an amount; these tests are about typing it into the
    // sheet afterwards, so answer 0 and leave that part doing the work.
    await drawer.getByLabel("Amount").fill("0");
    await withServerAction(page, () =>
      drawer.getByRole("button", { name: "Add", exact: true }).click(),
    );

    const row = await budgetRow(page, ISA, "500");
    await expect(row.getByText(`To ${ISA}`)).toBeVisible();

    // In Transfers, and nowhere else: a pension contribution is not spending,
    // so the Expenses total must not move.
    await expect(budgetCell(bandRow(page, "Transfers and saving"))).toHaveText(
      "£500",
    );
    await expect(budgetCell(bandRow(page, "Expenses"))).toHaveText("£0");
    // It still moves money, and the anchor is the account — money into your
    // ISA is money out of your pocket, so the surplus falls by it.
    await expect(budgetCell(bandRow(page, "Left over"))).toHaveText(
      /[−-]£500$/,
    );

    // Now the other half: a real movement, tagged as a transfer to the ISA.
    await page.goto("/transactions");
    const csv = `date,description,amount\n05/03/2026,${description},-500.00\n`;
    await importCsv(page, csv);
    const accountSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "New account" }) });
    await accountSelect.selectOption("__new__");
    await page.getByPlaceholder("e.g. Current account").fill(owning);
    await page.getByRole("button", { name: /Import 1 transaction/ }).click();
    await expect(page.getByText(/Imported 1/)).toBeVisible();

    // The ISA is offered under the picker's Transfers group. Scope to the row:
    // the popover renders inside it, and the account name also appears as an
    // <option> in the import account select.
    const ledgerRow = page.locator("tr", { hasText: description });
    await ledgerRow.getByRole("button", { name: /Uncategorized/ }).click();
    await withServerAction(page, () =>
      ledgerRow.getByRole("option", { name: ISA }).click(),
    );
    await expect(ledgerRow.getByText(/Transfer (to|from)/)).toBeVisible();

    // Back on the sheet, the row the user added now carries what actually
    // happened. Nothing new appeared: a tagged transfer fills an existing
    // row's actual, it does not create one.
    await page.goto("/budget?ym=2026-03");
    await expect(actualCell(bandRow(page, "Transfers and saving"))).toHaveText(
      "£500",
    );
    await expect(rowInput(page, ISA)).toHaveCount(1);
  });

  test("a budgeted repayment counts as spending, and Sync takes it to the mortgage", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);

    // A liability account and its first observed balance, through the drawer
    // a user would use.
    await page.goto("/balance");
    await openAddDrawer(page);
    await page.getByLabel(/what are you adding/i).selectOption("MORTGAGE");
    await page.getByLabel(/name/i).fill(MORTGAGE);
    await page.getByLabel(/section/i).selectOption("LONG_TERM");
    await page.getByLabel(/value now/i).fill("184200");
    await withServerAction(page, () =>
      page.getByRole("button", { name: /^add$/i }).click(),
    );
    await expect(rowInput(page, MORTGAGE)).toBeVisible();

    // A plan first, so the Sync below has something to move. Creating a plan
    // is a Sync against an empty one, so the mortgage arrives as a liability
    // — with nothing being paid at it yet.
    await page.goto("/plan");
    await createPlanWithDob(page);
    const liabilities = page.locator("section", { hasText: "Liabilities" });
    await expect(
      liabilities.getByRole("button", { name: new RegExp(MORTGAGE) }),
    ).toContainText("£184,200");
    await expect(
      page.getByRole("button", { name: /up to date/i }),
    ).toBeDisabled();

    // Budget £1,200/mo at the debt.
    await page.goto("/budget");
    const drawer = await openAnchoredDrawer(page, "Debt payment");
    await drawer.getByRole("button", { name: MORTGAGE, exact: true }).click();
    // The drawer asks for an amount; these tests are about typing it into the
    // sheet afterwards, so answer 0 and leave that part doing the work.
    await drawer.getByLabel("Amount").fill("0");
    await withServerAction(page, () =>
      drawer.getByRole("button", { name: "Add", exact: true }).click(),
    );

    const row = await budgetRow(page, MORTGAGE, "1200");
    await expect(row.getByText(`Towards ${MORTGAGE}`)).toBeVisible();

    // Under Expenses, and counted there — the money genuinely left, and a
    // mortgage is the first thing people look for under Expenses. It is not a
    // transfer: the Transfers band stays at zero.
    await expect(budgetCell(bandRow(page, "Debt payments", false))).toHaveText(
      "£1,200",
    );
    await expect(budgetCell(bandRow(page, "Expenses"))).toHaveText("£1,200");
    await expect(budgetCell(bandRow(page, "Transfers and saving"))).toHaveText(
      "£0",
    );

    // The plan now has something to do, and says so before it does it.
    await page.goto("/plan");
    const sync = page.getByRole("button", { name: /sync with latest/i });
    await expect(sync).toHaveText(/1 change$/);
    await expect(page.getByText("1 updated")).toBeVisible();

    await withServerAction(page, () => sync.click());
    await expect(
      page.getByRole("button", { name: /up to date/i }),
    ).toBeDisabled();

    // …and the budgeted figure is on the liability, in the unit its own
    // drawer displays: monthlyRepayment is monthly, where an asset's
    // annualContribution is annual.
    await page
      .locator("section", { hasText: "Liabilities" })
      .getByRole("button", { name: new RegExp(MORTGAGE) })
      .click();
    const planDrawer = page.getByRole("dialog");
    await expect(planDrawer).toBeVisible();
    // Interest, repayment and start age live in the collapsed "Terms"
    // section.
    await planDrawer.getByRole("button", { name: /^terms$/i }).click();
    await expect(
      planDrawer.getByLabel("Repayment /mo", { exact: true }),
    ).toHaveValue("1200");
  });
});

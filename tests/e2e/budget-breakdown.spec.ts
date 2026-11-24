// tests/e2e/budget-breakdown.spec.ts
//
// A budget Actual opens the transactions behind it, and "Open in ledger" shows
// those same rows. If this breaks, a user checking where a month's figure came
// from sees nothing, or a ledger that does not match the popover.
//
// The breakdown is fetched by a server action, so this is a server-action
// journey and chromium-gated per the repo's browser-coverage rule.

import type { Page } from "@playwright/test";
import { buildAccountData } from "@/lib/accounts/creation";
import {
  clearStarterPeriods,
  expect,
  signedInUser,
  signIn,
  test,
} from "./_helpers/fixtures";

/**
 * Clicks a row's Actual until its popover opens.
 *
 * The sheet is server-rendered, so the figure is clickable before React wires
 * it and the first click can be swallowed (see openAnchoredDrawer in
 * budget-transfers.spec.ts). Retrying while the popover is still closed
 * converges as soon as hydration catches up.
 */
async function openActual(page: Page, row: string) {
  const dialog = page.getByRole("dialog", { name: `${row} transactions` });
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: `${row} Actual` }).click();
    }
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

test.describe("budget Actual breakdown", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Server-action journey: the same server code through three engines tests it three times.",
    );
  });

  test("an Actual lists its transactions, and Open in ledger shows the same rows", async ({
    page,
    db,
  }) => {
    const token = `${Date.now()}`;
    const savingsName = `Savings-${token}`;
    const groceriesName = `Groceries-${token}`;

    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await db.userSettings.update({
      where: { userId: user.id },
      data: { transactionsEnabled: true },
    });

    const account = (name: string, type: "CURRENT_ACCOUNT" | "SAVINGS") =>
      db.account.create({
        data: { userId: user.id, name, ...buildAccountData({ type }) },
      });
    const current = await account(`Current-${token}`, "CURRENT_ACCOUNT");
    const monzo = await account(`Monzo-${token}`, "CURRENT_ACCOUNT");
    const savings = await account(savingsName, "SAVINGS");
    const groceries = await db.category.create({
      data: {
        userId: user.id,
        label: groceriesName,
        type: "EXPENSE",
        section: "VARIABLE",
      },
    });
    const period = await db.financialPeriod.create({
      data: {
        userId: user.id,
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    await db.budgetItem.createMany({
      data: [
        {
          periodId: period.id,
          categoryId: groceries.id,
          type: "EXPENSE",
          section: "VARIABLE",
          label: groceriesName,
          budget: 400,
          sortOrder: 0,
        },
        {
          periodId: period.id,
          accountId: savings.id,
          type: "TRANSFER",
          direction: "INFLOW",
          label: savingsName,
          budget: 500,
          sortOrder: 1,
        },
      ],
    });
    await db.transaction.createMany({
      data: [
        {
          userId: user.id,
          accountId: current.id,
          categoryId: groceries.id,
          date: new Date("2026-03-02"),
          amount: -64.2,
          description: `TESCO-${token}`,
        },
        {
          userId: user.id,
          accountId: monzo.id,
          categoryId: groceries.id,
          isCategoryConfirmed: false,
          date: new Date("2026-03-06"),
          amount: -38.75,
          description: `SAINSBURYS-${token}`,
        },
        // Both sides of one movement: only the savings side counts.
        {
          userId: user.id,
          accountId: savings.id,
          transferAccountId: current.id,
          date: new Date("2026-03-03"),
          amount: 200,
          description: `FromCurrent-${token}`,
        },
        {
          userId: user.id,
          accountId: current.id,
          transferAccountId: savings.id,
          date: new Date("2026-03-03"),
          amount: -200,
          description: `ToSavings-${token}`,
        },
        // Recorded only on Monzo's side.
        {
          userId: user.id,
          accountId: monzo.id,
          transferAccountId: savings.id,
          date: new Date("2026-03-24"),
          amount: -50,
          description: `Pot-${token}`,
        },
      ],
    });

    await page.goto("/budget?ym=2026-03");

    // A category row: its transactions, the pencilled one counted; Esc closes.
    const grocery = await openActual(page, groceriesName);
    await expect(grocery).toContainText("2 transactions · 1 still in pencil");
    await expect(grocery).toContainText(`SAINSBURYS-${token}`);
    await page.keyboard.press("Escape");
    await expect(grocery).toBeHidden();

    // A transfer row: one side per pair, the other side labelled.
    const transfer = await openActual(page, savingsName);
    await expect(transfer).toContainText("2 transactions");
    await expect(
      transfer.getByRole("row", { name: new RegExp(`Pot-${token}`) }),
    ).toContainText(`Recorded on Monzo-${token}'s side`);
    await expect(transfer).not.toContainText(`ToSavings-${token}`);

    await transfer.getByRole("link", { name: /Open in ledger/ }).click();
    await expect(page).toHaveURL(/\/transactions\?counted=/);
    await expect(
      page.getByText(`Counted in budget: ${savingsName} · Mar 2026`),
    ).toBeVisible();
    await expect(
      page.locator("tr", { hasText: `FromCurrent-${token}` }),
    ).toHaveCount(1);
    await expect(page.locator("tr", { hasText: `Pot-${token}` })).toHaveCount(
      1,
    );
    await expect(
      page.locator("tr", { hasText: `ToSavings-${token}` }),
    ).toHaveCount(0);
  });
});

// How the popover opens and closes, on every engine. Not gated: it asserts
// focus, which engines genuinely differ on — WebKit does not focus a clicked
// button, so a second click on the figure reaches the popover's blur with no
// relatedTarget, and must still close it rather than close-and-reopen.
test.describe("budget Actual popover focus", () => {
  test("opens on the figure, closes on Esc, a second click or a click outside", async ({
    page,
    db,
  }) => {
    const token = `${Date.now()}`;
    const row = `Food-${token}`;

    await signIn(page);
    const user = await signedInUser(db);
    await clearStarterPeriods(db, user.id);
    await db.userSettings.update({
      where: { userId: user.id },
      data: { transactionsEnabled: true },
    });
    const current = await db.account.create({
      data: {
        userId: user.id,
        name: `Current-${token}`,
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const category = await db.category.create({
      data: {
        userId: user.id,
        label: row,
        type: "EXPENSE",
        section: "VARIABLE",
      },
    });
    const period = await db.financialPeriod.create({
      data: {
        userId: user.id,
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    await db.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "VARIABLE",
        label: row,
        budget: 100,
      },
    });
    await db.transaction.create({
      data: {
        userId: user.id,
        accountId: current.id,
        categoryId: category.id,
        date: new Date("2026-03-05"),
        amount: -12.5,
        description: `Lunch-${token}`,
      },
    });

    await page.goto("/budget?ym=2026-03");
    const figure = page.getByRole("button", { name: `${row} Actual` });

    // Esc closes it and hands focus back to the figure.
    const dialog = await openActual(page, row);
    await expect(dialog).toContainText("1 transaction");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(figure).toBeFocused();

    // A second click of the figure closes it, and it stays closed.
    await openActual(page, row);
    await figure.click();
    await expect(dialog).toBeHidden();
    await expect(figure).toHaveAttribute("aria-expanded", "false");

    // A click elsewhere on the page closes it.
    await openActual(page, row);
    await page.getByRole("heading", { level: 1 }).click();
    await expect(dialog).toBeHidden();
  });
});

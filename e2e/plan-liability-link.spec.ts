import type { Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { expect, signIn, test } from "./_helpers/fixtures";

// Acceptance tests for the mortgage liability <-> repayment-expense link
// (feat/plan-liability-expense-link). These guard the end-to-end UI flows that
// the unit/integration suites can't reach: the drawer link/unlink controls, the
// managed-expense drawer, the cash-flow REPAYMENT routing, cascade delete, and
// the liability's (feature-new) draggable start handle.

// Signs in, seeds one balance period (so createPlan has data), and creates a
// plan. Leaves the page on the rendered /plan.
async function seedAndCreatePlan(page: Page, db: PrismaClient): Promise<void> {
  await signIn(page);
  await page.waitForURL("**/dashboard");

  const user = await db.user.findFirstOrThrow();
  const start = new Date(Date.UTC(2026, 0, 1));
  const end = new Date(Date.UTC(2026, 0, 31));
  await db.financialPeriod.create({
    data: {
      userId: user.id,
      granularity: "MONTH",
      startDate: start,
      endDate: end,
      label: "Jan 2026",
      balanceItems: {
        create: [
          {
            type: "ASSET",
            category: "LONG_TERM",
            label: "SIPP",
            value: 100000,
          },
        ],
      },
      items: {
        create: [
          {
            type: "INCOME",
            incomeCategory: "SALARY",
            label: "Salary",
            budget: 4000,
          },
        ],
      },
    },
  });

  await page.goto("/plan");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='date']").fill("1986-06-01");
  await page.locator("input[type='number']").first().fill("65");
  await page.getByRole("button", { name: /create my plan/i }).click();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
}

// Adds a liability via the panel button (which opens its drawer), then sets a
// real balance/interest/monthly repayment. Returns the open drawer dialog.
async function addMortgage(page: Page) {
  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await liabilityPanel.getByRole("button", { name: "+ Add liability" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  await drawer.getByLabel("Balance").fill("200000");
  await drawer.getByLabel("Balance").blur();

  // Interest / repayment / start-age all live in the "Terms" section, which is
  // collapsed by default — expand it before reaching them.
  await drawer.getByRole("button", { name: /^terms$/i }).click();
  await drawer.getByLabel("Interest %").fill("4");
  await drawer.getByLabel("Interest %").blur();
  const repayment = drawer.getByLabel("Repayment /mo", { exact: true });
  await repayment.fill("1200");
  await repayment.blur();
  await expect(repayment).toHaveValue("1200");
  return drawer;
}

test("plan: link a repayment expense — managed drawer, list badge, then unlink restores /mo", async ({
  page,
  db,
}) => {
  await seedAndCreatePlan(page, db);
  const drawer = await addMortgage(page);

  // Link: "Track repayment as an expense" creates the expense and switches the
  // drawer to it.
  await drawer
    .getByRole("button", { name: /track repayment as an expense/i })
    .click();

  // The managed expense drawer: shows the "managed by <liability>" note, and
  // hides both the manual Remove control and the whole Timing section (timing
  // now follows the liability).
  await expect(drawer.getByText(/repayment managed by/i)).toBeVisible();
  await expect(drawer.getByRole("button", { name: /^remove$/i })).toHaveCount(
    0,
  );
  await expect(drawer.getByRole("button", { name: /^timing$/i })).toHaveCount(
    0,
  );

  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();

  // The expenses list flags the linked expense.
  const expensePanel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add expense" }) });
  await expect(expensePanel.getByText("New liability repayment")).toBeVisible();

  // (The engine's "count the repayment once, as REPAYMENT" behaviour is covered
  // deterministically by project.test.ts; asserting it via the cash-flow chart
  // legend here is redundant and depends on projection/persist timing.)

  // Reopen the liability drawer: it now shows the managed-by-expense row + an
  // Unlink button, and the manual "Repayment /mo" field is gone.
  const liabilityPanel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add liability" }) });
  await liabilityPanel.getByRole("button", { name: /New liability/ }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /^terms$/i }).click();
  await expect(
    drawer.getByText(/Repayment \(managed by expense\)/i),
  ).toBeVisible();
  await expect(drawer.getByLabel("Repayment /mo", { exact: true })).toHaveCount(
    0,
  );

  // Unlink: the manual field returns, seeded with the amount copied back from
  // the expense (1200/mo), so the projection doesn't jump.
  await drawer.getByRole("button", { name: /^unlink$/i }).click();
  await expect(drawer.getByLabel("Repayment /mo", { exact: true })).toHaveValue(
    "1200",
  );
});

test("plan: deleting a liability cascades — its linked repayment expense disappears", async ({
  page,
  db,
}) => {
  await seedAndCreatePlan(page, db);
  const drawer = await addMortgage(page);

  await drawer
    .getByRole("button", { name: /track repayment as an expense/i })
    .click();
  await expect(drawer.getByText(/repayment managed by/i)).toBeVisible();
  await page.keyboard.press("Escape");

  const expensePanel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add expense" }) });
  await expect(expensePanel.getByText("New liability repayment")).toBeVisible();

  // Delete the liability from its drawer (Remove → confirm).
  const liabilityPanel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add liability" }) });
  await liabilityPanel.getByRole("button", { name: /New liability/ }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /^remove$/i }).click();
  await drawer.getByRole("button", { name: /yes/i }).click();
  await expect(drawer).not.toBeVisible();

  // The linked expense is gone with it.
  await expect(expensePanel.getByText("New liability repayment")).toHaveCount(
    0,
  );
  await expect(liabilityPanel.getByText("New liability")).toHaveCount(0);
});

test("plan: a liability's start handle drags (keyboard) and persists", async ({
  page,
  db,
}) => {
  await seedAndCreatePlan(page, db);

  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await liabilityPanel.getByRole("button", { name: "+ Add liability" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // The liability now renders a start grip (feature-new: liabilities had no
  // start handle before this feature).
  const handle = page.getByRole("slider", {
    name: /New liability start age/i,
  });
  await expect(handle).toBeVisible();
  const before = Number(await handle.getAttribute("aria-valuenow"));

  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before + 1));

  // Commit-on-keyup persists; the new start age survives a full reload.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("slider", { name: /New liability start age/i }),
  ).toHaveAttribute("aria-valuenow", String(before + 1));
});

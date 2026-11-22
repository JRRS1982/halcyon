// tests/e2e/sheet-fit.spec.ts
//
// The budget sheet's columns used to be fixed widths, so a six-figure total
// with pence ran out of its cell and printed over the one beside it ("£0.00"
// under "£25,802.34 below"), and a signed total broke onto two lines with the
// minus on its own. The columns now size to their widest figure; only a real
// layout engine can say whether every figure fits.
import type { Page } from "@playwright/test";
import { expect, signedInUser, signIn, test } from "./_helpers/fixtures";

const WIDTHS = [1280, 900, 390];

// Every figure cell whose content is wider than the cell, or that wraps.
async function figuresThatDoNotFit(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sheet = document.querySelector("[data-sheet-scroller]");
    const cells = sheet?.querySelectorAll<HTMLElement>(
      '[role="row"] > div:nth-child(n + 2):nth-child(-n + 4)',
    );
    return [...(cells ?? [])].flatMap((cell) => {
      if (cell.offsetParent === null) return [];
      // Column heads are words, not figures, and "vs budget" is hidden from
      // sight: its 1px screen-reader box sits outside the cell by design.
      if (cell.getAttribute("role") === "columnheader") return [];
      const input = cell.querySelector("input");
      if (input) {
        return input.scrollWidth > input.clientWidth
          ? [`${input.value} is cut off`]
          : [];
      }
      const text = cell.textContent?.trim() ?? "";
      if (!text) return [];
      const range = document.createRange();
      range.selectNodeContents(cell);
      const content = range.getBoundingClientRect();
      const box = cell.getBoundingClientRect();
      // Two lines of text stand at least twice the font size; one line,
      // whatever its line-height, does not reach that.
      const fontSize = Number.parseFloat(getComputedStyle(cell).fontSize);
      if (content.height >= 2 * fontSize) return [`${text} wraps`];
      if (content.left < box.left || content.right > box.right) {
        return [`${text} spills out of its cell`];
      }
      return [];
    });
  });
}

test("every budget figure fits its own cell, pence and six figures included", async ({
  page,
  db,
}) => {
  await signIn(page);
  const user = await signedInUser(db);
  await expect
    .poll(() => db.financialPeriod.count({ where: { userId: user.id } }))
    .toBeGreaterThan(0);
  const period = await db.financialPeriod.findFirstOrThrow({
    where: { userId: user.id },
  });
  // Seventeen rows of £24,567.89 make six-figure section totals, and an
  // all-budget, no-actual month makes every variance as long as it gets.
  await db.budgetItem.updateMany({
    where: { periodId: period.id },
    data: { budget: 24567.89 },
  });
  await db.userSettings.update({
    where: { userId: user.id },
    data: { numberFormat: "COMMA_2" },
  });

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/budget");
    await expect(page.getByRole("table", { name: "Budget" })).toBeVisible();
    expect(await figuresThatDoNotFit(page), `at ${width}px`).toEqual([]);
  }
});

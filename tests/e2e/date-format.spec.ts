// tests/e2e/date-format.spec.ts
//
// The date format setting, end to end: chosen in Settings, saved, read back by
// the app layout and handed to a date field on another page. If any hop drops
// it, a user who picked month-first is still typing day-first, and 03/04 means
// the wrong month.
import { expect, signIn, test, withServerAction } from "./_helpers/fixtures";

test.beforeEach(({ browserName }) => {
  // A server-action journey ending in a write: the same server code on every
  // engine. See CLAUDE.md → Browser coverage.
  test.skip(browserName !== "chromium", "server-action journey");
});

test("choosing month-first in Settings puts the month first in the ledger's date filter", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/settings");
  const dateFormat = page.getByLabel("Date format");
  await expect(dateFormat).toHaveValue("DMY");
  await withServerAction(page, () => dateFormat.selectOption("MDY"));
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto("/transactions");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const from = page.getByRole("group", { name: "From" });
  await expect(from.getByRole("textbox").first()).toHaveAttribute(
    "placeholder",
    "MM",
  );
  await expect(from.getByRole("textbox").nth(1)).toHaveAttribute(
    "placeholder",
    "DD",
  );
});

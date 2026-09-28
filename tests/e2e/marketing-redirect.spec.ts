// e2e/marketing-redirect.spec.ts
//
// The "signed-in visitors skip the marketing page" rule moved from the "/"
// server component into the proxy. This covers the case the proxy is
// responsible for: a real navigation to "/" by someone who already has a
// session — a bookmark, the logo link, or typing the bare domain.
import { expect, signIn, test } from "./_helpers/fixtures";

test.describe("Marketing page for signed-in users", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("a direct visit to / lands in the app", async ({ page }) => {
    await signIn(page);

    await page.goto("/");

    await expect(page).toHaveURL(/\/transactions$/);
    // Page title, not the ledger's section heading of the same name.
    await expect(
      page.getByRole("heading", { level: 1, name: "Transactions" }),
    ).toBeVisible();
  });

  test("the brand link in the nav goes into the app, not the pitch", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");

    await page.getByRole("link", { name: /balanced money/i }).click();

    await expect(page).toHaveURL(/\/transactions$/);
  });
});

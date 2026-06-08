// e2e/landing.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("an unauthenticated visitor sees the marketing page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /make sense of your money/i,
      }),
    ).toBeVisible();
    // Both hero CTAs present
    await expect(
      page.getByRole("link", { name: /get started/i }).first(),
    ).toBeVisible();
  });

  test("Get started navigates to sign-up", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /get started/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("nav anchor scrolls to How it works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /how it works/i }).click();
    await expect(page).toHaveURL(/#how/);
    await expect(page.locator("#how")).toBeVisible();
  });
});

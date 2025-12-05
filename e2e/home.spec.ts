import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Halcyon/i);
  });

  test("should be accessible", async ({ page }) => {
    await page.goto("/");
    // Basic accessibility check - page should have a main landmark
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});

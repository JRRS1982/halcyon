import { expect, test } from "@playwright/test";

test.describe("legal pages", () => {
  test("privacy page renders signed-out", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/privacy$/); // not redirected to sign-in
  });

  test("terms page renders signed-out", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/terms$/);
  });

  test("footer links navigate to the legal pages", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Privacy" })
      .click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goBack();
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Terms" })
      .click();
    await expect(page).toHaveURL(/\/terms$/);
  });
});

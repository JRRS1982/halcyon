import { expect, test } from "@playwright/test";

// The engineering tour. Public on purpose — the whole point is being able to
// hand someone the link — so the first assertion is that it renders without a
// session rather than bouncing to sign-in.
test.describe("how it's built", () => {
  test("renders signed-out with every section present", async ({ page }) => {
    await page.goto("/how-its-built");

    await expect(
      page.getByRole("heading", { name: "How it’s built", level: 1 }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/how-its-built$/); // not redirected to sign-in

    for (const heading of [
      "Architecture and stack",
      "Validation and type safety",
      "Authentication and sessions",
      "Abuse resistance and rate limiting",
      "Your data, and who can reach it",
      "Correctness and data integrity",
      "Testing and delivery",
      "Interface, accessibility and operations",
    ]) {
      await expect(
        page.getByRole("heading", { name: heading, level: 2 }),
      ).toBeVisible();
    }
  });

  test("carries no links of its own", async ({ page }) => {
    await page.goto("/how-its-built");
    // Deliberate: the page is a standalone read, so nothing in <main> links out.
    await expect(page.locator("main a")).toHaveCount(0);
  });

  test("the marketing footer links to it", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Engineering" })
      .click();
    await expect(page).toHaveURL(/\/how-its-built$/);
  });
});

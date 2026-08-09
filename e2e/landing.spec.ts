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
    // "How it works" appears in both the nav and the footer; scope to the nav.
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /how it works/i })
      .click();
    await expect(page).toHaveURL(/#how/);
    await expect(page.locator("#how")).toBeVisible();
  });

  test("Sign in navigates to sign-in", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /^sign in$/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Features and Details anchors resolve", async ({ page }) => {
    await page.goto("/");
    // These labels appear in both the nav and the footer; scope to the nav.
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: /^features$/i }).click();
    await expect(page.locator("#features")).toBeVisible();
    await nav.getByRole("link", { name: /^details$/i }).click();
    await expect(page.locator("#details")).toBeVisible();
  });

  test("renders without horizontal overflow on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("Trust", () => {
  // The first objection a personal-finance app meets is "what are you doing
  // with my bank access". The answer — there is no bank connection — lived in
  // /guide and the privacy notice, while the page that has to overcome the
  // objection said nothing.
  test("the hero answers the bank-access objection", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/no bank connection, ever/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /export or delete/i }),
    ).toHaveAttribute("href", "/guide");
  });
});

test.describe("Footers", () => {
  // The landing page brings its own MarketingFooter. The app footer used to
  // step aside by checking the pathname; now the marketing layout simply
  // doesn't render one — so the thing worth asserting is that exactly one
  // footer survives, not that a component knows where it is.
  test("the landing page has exactly one footer, and it is the marketing one", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: /full guide/i }),
    ).toBeVisible();
  });
});

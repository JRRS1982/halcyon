// tests/e2e/landing.spec.ts
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

  // The front page is articles that link out; the nav's one-word links go to
  // the pages that hold the detail.
  test("the nav's Features link opens the features page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /^features$/i })
      .click();
    await expect(page).toHaveURL(/\/features$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /^features$/i }),
    ).toBeVisible();
  });

  test("a feature article opens its own page", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/features/budget"]').first().click();
    await expect(page).toHaveURL(/\/features\/budget$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /where did the money go/i }),
    ).toBeVisible();
  });

  test("Sign in navigates to sign-in", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /^sign in$/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in/);
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
  // The trust line: the visitor controls what goes in, and can take it all
  // out again. Worded so it stays true whatever the app adds later.
  test("the hero says the visitor controls their data", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/you choose what goes in/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "export or delete", exact: true }),
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
      page.getByRole("contentinfo").getByRole("link", { name: /^guide$/i }),
    ).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

// The design system, rendered from DESIGN.md. Public on purpose — the point is
// being able to hand someone (or something) the link — so the first assertion
// is that it renders without a session rather than bouncing to sign-in.
test.describe("design system", () => {
  test("renders signed-out with the document's own sections", async ({
    page,
  }) => {
    await page.goto("/design");

    await expect(
      page.getByRole("heading", {
        name: "Balanced Money design system",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/design$/); // not redirected to sign-in

    for (const heading of ["Overview", "Colors", "Typography", "Components"]) {
      await expect(
        page.getByRole("heading", { name: heading, level: 2 }),
      ).toBeVisible();
    }
  });

  // The reason the boards are generated from palette.ts rather than written
  // out: a token cannot be in the palette and missing from the page.
  test("boards the colour tokens with both schemes' values", async ({
    page,
  }) => {
    await page.goto("/design");

    await expect(
      page.getByText("accent", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("#1E5BC6").first()).toBeVisible();
    await expect(page.getByText("#7FA6FF").first()).toBeVisible();
  });

  // Located by href rather than by name: the contents links are uppercased in
  // CSS, and an accessible name computed from rendered text would depend on
  // whether the engine applies text-transform.
  test("a section link jumps to its heading", async ({ page }) => {
    await page.goto("/design");

    await page.locator('nav a[href="#components"]').click();
    await expect(page).toHaveURL(/#components$/);
  });

  test("serves the raw file at /design.md", async ({ page }) => {
    const response = await page.request.get("/design.md");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");
    expect(await response.text()).toContain("## Overview");
  });

  test("the marketing footer links to it", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Design system" })
      .click();
    await expect(page).toHaveURL(/\/design$/);
  });
});

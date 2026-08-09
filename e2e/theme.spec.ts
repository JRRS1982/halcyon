// e2e/theme.spec.ts
//
// The scheme is decided by CSS (a media query plus a data-theme attribute the
// server writes), so the only way to test it is to ask a real browser what it
// actually resolved — with a real OS preference set.
import { expect, signIn, test } from "./_helpers/fixtures";

const LIGHT_CANVAS = "#FFFFFF";
const DARK_CANVAS = "#0F1116";

// Reads the resolved custom property rather than a rendered colour, so the
// assertion names the token that is wrong when it fails.
const canvas = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--c-canvas")
      .trim()
      .toUpperCase(),
  );

const chooseScheme = async (
  page: import("@playwright/test").Page,
  label: string,
) => {
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: /colour scheme/i })
    .selectOption({ label });
};

test.describe("Colour scheme", () => {
  test.describe("following the system", () => {
    test.use({ colorScheme: "dark" });

    test("a dark OS gives a dark app, with no preference stored", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/dashboard");

      expect(await canvas(page)).toBe(DARK_CANVAS);
      // No attribute at all is what lets the media query decide — and keeps it
      // deciding when the user changes their OS setting later.
      await expect(page.locator("[data-theme]")).toHaveCount(0);
    });

    test("choosing Light overrides a dark system", async ({ page }) => {
      await signIn(page);
      await chooseScheme(page, "Light");

      // On the (app) wrapper rather than <html>: the root layout deliberately
      // knows nothing about the session, so the marketing page can prerender.
      await expect(page.locator("[data-theme]")).toHaveAttribute(
        "data-theme",
        "light",
      );
      expect(await canvas(page)).toBe(LIGHT_CANVAS);

      // And it survives a reload — the point of storing it.
      await page.reload();
      expect(await canvas(page)).toBe(LIGHT_CANVAS);
    });
  });

  test.describe("overriding a light system", () => {
    test.use({ colorScheme: "light" });

    test("a light OS gives a light app by default", async ({ page }) => {
      await signIn(page);
      await page.goto("/dashboard");

      expect(await canvas(page)).toBe(LIGHT_CANVAS);
    });

    test("choosing Dark applies immediately and persists", async ({ page }) => {
      await signIn(page);
      await chooseScheme(page, "Dark");

      await expect(page.locator("[data-theme]")).toHaveAttribute(
        "data-theme",
        "dark",
      );
      // The root picks the choice up through :has(), so the page background and
      // scrollbars follow it too — not just the wrapper's subtree.
      expect(await canvas(page)).toBe(DARK_CANVAS);

      await page.goto("/budget");
      expect(await canvas(page)).toBe(DARK_CANVAS);
    });

    // The whole reason the scheme is resolved on the server. If it were decided
    // after hydration, the first frame would be light and then correct itself.
    test("a stored dark preference is in the server's HTML, not applied later", async ({
      page,
    }) => {
      await signIn(page);
      await chooseScheme(page, "Dark");

      // Asserted against the raw response rather than the live DOM: reading an
      // attribute mid-navigation races the parser, and the claim here is about
      // what the *server* sent — if the attribute is in the markup, there is no
      // frame in which the wrong scheme could paint.
      const response = await page.request.get("/budget");
      const html = await response.text();

      expect(html).toContain('data-theme="dark"');
    });
  });
});

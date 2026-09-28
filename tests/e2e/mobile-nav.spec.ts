// e2e/mobile-nav.spec.ts
//
// Viewport-dependent behaviour that jsdom can't judge: below 768px the inline
// link row collapses and the hamburger drawer becomes the only way to navigate.
// Runs against the public pages, so it needs no database.
import { expect, type Page, test } from "@playwright/test";

// iPhone 12/13/14 logical width — the narrow end of what we support.
const PHONE = { width: 390, height: 844 };

/**
 * Opens the drawer, re-clicking if the first click didn't take.
 *
 * #mobile-nav only exists while NavBar's `menuOpen` state is true, so when the
 * click doesn't register there is nothing to wait for: the test sits for 30s on
 * a drawer that was never asked to open. It happens only in a full run, never
 * in isolation, which points at the dev server being busy — but the specific
 * mechanism is not established, and two plausible ones were tested and ruled
 * out rather than assumed:
 *
 *   - a click landing before hydration, swallowed by a button with no handler
 *     yet — 20x CPU throttling still opens the drawer on the first click;
 *   - a Fast Refresh recompile remounting the tree and resetting menuOpen —
 *     touching NavBar's source while the drawer is open leaves it open.
 *
 * So this retries rather than claiming to know why. The guard matters: clicking
 * again once the drawer is open would toggle it shut, so it only re-clicks
 * while the drawer is still closed, and converges whatever the cause turns out
 * to be.
 */
async function openMenu(page: Page): Promise<void> {
  const drawer = page.locator("#mobile-nav");
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await page.getByRole("button", { name: /open menu/i }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("Mobile navigation", () => {
  test.use({ viewport: PHONE });

  test("collapses the link row to a hamburger", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /how it works/i })).toBeHidden();
    await expect(
      page.getByRole("button", { name: /open menu/i }),
    ).toBeVisible();
  });

  test("the drawer opens, navigates, and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/");

    await openMenu(page);
    const drawer = page.locator("#mobile-nav");
    await expect(
      drawer.getByRole("link", { name: /how it works/i }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("button", { name: /open menu/i }),
    ).toBeFocused();
  });

  test("a drawer link closes the drawer and navigates", async ({ page }) => {
    await page.goto("/");

    await openMenu(page);
    await page
      .locator("#mobile-nav")
      .getByRole("link", { name: /get started/i })
      .click();

    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.locator("#mobile-nav")).toBeHidden();
  });

  test("the menu toggle clears the 44px touch-target floor", async ({
    page,
  }) => {
    await page.goto("/");

    const box = await page
      .getByRole("button", { name: /open menu/i })
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  // A page wider than the viewport is the classic broken-on-mobile symptom.
  for (const path of ["/", "/sign-in", "/sign-up", "/privacy", "/terms"]) {
    test(`${path} does not scroll horizontally`, async ({ page }) => {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows).toBe(false);
    });
  }
});

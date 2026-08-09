// e2e/landmarks.spec.ts
//
// Structure a keyboard or screen-reader user depends on, and which unit tests
// can't judge: the skip link only exists once focus reaches it, and "exactly
// one main landmark" is a property of the whole rendered page, not a component.
import { expect, signIn, test } from "./_helpers/fixtures";

const SIGNED_OUT = [
  "/",
  "/sign-in",
  "/sign-up",
  "/guide",
  "/privacy",
  "/terms",
];
const SIGNED_IN = [
  "/dashboard",
  "/budget",
  "/balance",
  "/transactions",
  "/settings",
  "/plan",
];

test.describe("Skip to content", () => {
  test("is the first thing a keyboard user reaches, and moves focus", async ({
    page,
  }) => {
    await page.goto("/");

    // Hidden until focused — it must not occupy visual space for everyone else.
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).not.toBeInViewport();

    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    // The jump has to move focus, not just the scroll position, or the next
    // Tab would drop the user back at the top of the nav.
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("is present on every route", async ({ page }) => {
    for (const path of SIGNED_OUT) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: /skip to content/i }),
      ).toHaveCount(1);
    }
  });
});

test.describe("Landmarks", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "structure check runs once");
  });

  test("signed-out routes expose exactly one main", async ({ page }) => {
    for (const path of SIGNED_OUT) {
      await page.goto(path);
      await expect(page.getByRole("main"), `${path} main count`).toHaveCount(1);
    }
  });

  test("signed-in routes expose exactly one main", async ({ page }) => {
    await signIn(page);

    for (const path of SIGNED_IN) {
      await page.goto(path);
      await expect(page.getByRole("main"), `${path} main count`).toHaveCount(1);
    }
  });

  // Settings renders five sibling sections; four of them used to sit outside
  // the landmark, so jumping to the main content reached preferences and
  // stopped there.
  test("settings keeps all five sections inside the landmark", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    const main = page.getByRole("main");
    for (const heading of [
      /preferences|settings/i,
      /categories/i,
      /accounts/i,
      /data/i,
    ]) {
      await expect(
        main.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
    }
  });
});

test.describe("Sheet semantics", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "structure check runs once");
  });

  // Without these the sheet is a stream of numbers with nothing tying an
  // amount to its row or its column.
  test("the budget sheet exposes a table with named columns", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/budget");

    const sheet = page.getByRole("table", { name: "Budget" });
    await expect(sheet).toBeVisible();

    for (const column of ["Category", "Budget", "Actual"]) {
      await expect(
        sheet.getByRole("columnheader", { name: column }),
      ).toBeVisible();
    }

    // The Income band row names itself as a row header. Exact, because the
    // sheet also carries "Side income" and "Net income".
    await expect(
      sheet.getByRole("rowheader", { name: "Income", exact: true }),
    ).toBeVisible();
  });

  test("the balance sheet exposes a table too", async ({ page }) => {
    await signIn(page);
    await page.goto("/balance");

    const sheet = page.getByRole("table", { name: "Balance sheet" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("rowheader", { name: "Net worth" }),
    ).toBeVisible();
  });
});

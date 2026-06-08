import { expect, test } from "@playwright/test";

// The mock Supabase server is pre-seeded with this user.
const KNOWN_USER = { email: "test@example.com", password: "password123" };

test.describe.configure({ mode: "serial" });

test.describe("unauthenticated", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("home shows the sign-in / sign-up links", async ({ page }) => {
    await page.goto("/");
    // The unauthenticated home is the marketing landing page; the nav offers
    // both a Sign in link (→ /sign-in) and a Get started pill (→ /sign-up).
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("/dashboard redirects to /sign-in?next=/dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("sign-up", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // Helper: disable native HTML5 validation so the form submits and the server-
  // side zod schema gets to do the checking. Without this, type=email and
  // minlength=8 would block submit before any network call.
  const disableNativeValidation = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("form");
      if (form) form.noValidate = true;
    });

  test("zod rejects invalid email (server-side error)", async ({ page }) => {
    await page.goto("/sign-up");
    await disableNativeValidation(page);
    await page.fill("input[name='email']", "not-an-email");
    await page.fill("input[name='password']", "longenough123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up\?error=/);
    await expect(
      page
        .locator('p[role="alert"]')
        .filter({ hasText: /Enter a valid email/ }),
    ).toBeVisible();
  });

  test("zod rejects short password", async ({ page }) => {
    await page.goto("/sign-up");
    await disableNativeValidation(page);
    await page.fill("input[name='email']", "short@example.com");
    await page.fill("input[name='password']", "tiny");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up\?error=/);
    await expect(
      page
        .locator('p[role="alert"]')
        .filter({ hasText: /Password must be at least 8 characters/ }),
    ).toBeVisible();
  });

  test("happy path shows the 'check your email' message", async ({ page }) => {
    await page.goto("/sign-up");
    await page.fill("input[name='email']", `new+${Date.now()}@example.com`);
    await page.fill("input[name='password']", "password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up\?success=1/);
    await expect(page.getByRole("status")).toContainText(/Check your email/);
  });
});

test.describe("sign-in", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("happy path lands on home, signed in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("input[name='email']", KNOWN_USER.email);
    await page.fill("input[name='password']", KNOWN_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(/Signed in as/)).toBeVisible();
    await expect(page.getByText(KNOWN_USER.email)).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("input[name='email']", KNOWN_USER.email);
    await page.fill("input[name='password']", "wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in\?error=/);
    await expect(
      page
        .locator('p[role="alert"]')
        .filter({ hasText: /Invalid login credentials/ }),
    ).toBeVisible();
  });

  test("?next= takes the user back to the originally-requested page", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
    await page.fill("input[name='email']", KNOWN_USER.email);
    await page.fill("input[name='password']", KNOWN_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });
});

test.describe("sign-out", () => {
  test("clears the session; /dashboard becomes inaccessible again", async ({
    page,
  }) => {
    // Sign in first.
    await page.goto("/sign-in");
    await page.fill("input[name='email']", KNOWN_USER.email);
    await page.fill("input[name='password']", KNOWN_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");

    // Sign out.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/sign-in");

    // /dashboard should now bounce us back to /sign-in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Google OAuth (button only)", () => {
  // Real OAuth requires a third-party provider. Asserting the entry point
  // is present is the most we can do without spinning up a fake Google.
  test("button is rendered on sign-in and sign-up", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();

    await page.goto("/sign-up");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});

// tests/e2e/settings-change-password.spec.ts
//
// Changing a password from Settings, in a real browser.
//
// The claim worth an e2e is the round trip: the panel is rendered only for an
// account that signs in with a password, the action is handed the pair, and
// the password the account actually signs in with afterwards is the new one.
// Nothing short of a whole journey can show the last part — a 200 from
// updateUser proves the call was made, not that anything moved.
import { expect, signIn, test, withServerAction } from "./_helpers/fixtures";

// Its own account. The mock auth server's user store is in-memory and shared
// by every spec in the run, so rotating the known user's password here would
// sign out everything that ran after it.
const ROTATING = {
  email: "rotate@example.com",
  password: "e2e-rotate-123456",
  next: "e2e-rotated-789012",
};

async function signInAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/sign-in");
  await page.fill("input[name='email']", email);
  await page.fill("input[name='password']", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/transactions$/);
}

// Next's route announcer is also role="alert", so every lookup is scoped to
// the panel rather than the page.
const passwordPanel = (page: import("@playwright/test").Page) =>
  page.locator("section").filter({
    has: page.getByRole("heading", { name: "Password", exact: true }),
  });

// Both inputs are controlled and the button is `disabled` until each has a
// value, so a fill() landing before React hydrates is discarded when the
// controlled value reconciles back to "" — the button then never enables.
// Retrying the fill until it does is the pattern createPlanWithDob documents
// for the identical shape; it survives a slow hydrate instead of assuming one.
//
// DataPrivacy's panel does not need this only because it appears after a
// click, which cannot land before hydration. This one is on the page already.
async function fillBoth(
  page: import("@playwright/test").Page,
  current: string,
  next: string,
): Promise<void> {
  await page.waitForLoadState("networkidle");
  const submit = page.getByRole("button", { name: "Change password" });

  await expect(async () => {
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password").fill(next);
    await expect(submit).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

// Native constraint validation would refuse the submit before the action is
// reached. auth.spec.ts does the same to prove the server rule on sign-up.
const disableNativeValidation = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    for (const form of document.querySelectorAll("form")) {
      form.setAttribute("novalidate", "");
    }
  });

test.describe("Settings → password", () => {
  // Not gated: which controls render and whether the button is enabled is
  // label/htmlFor association and the accessibility tree, where engines
  // genuinely differ. CLAUDE.md says never to gate those.
  test("offers the panel to an account that signs in with a password", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    await expect(page.getByLabel("Current password")).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change password" }),
    ).toBeDisabled();
  });

  test("enables the button only once both fields are filled", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    const submit = page.getByRole("button", { name: "Change password" });
    await expect(submit).toBeDisabled();

    await fillBoth(page, "something", "a-long-enough-one");
    await expect(submit).toBeEnabled();
  });

  // The floor is the schema's, and the schema runs in the action — so native
  // validation is switched off first, exactly as auth.spec.ts does for the
  // same rule on sign-up. Otherwise the browser refuses the submit and the
  // server's rule is never reached, which is the half that matters.
  test("holds the twelve-character floor server-side", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "server-action journey");

    await signIn(page);
    await page.goto("/settings");
    await disableNativeValidation(page);

    await fillBoth(page, "e2e-password-123", "tooshort");
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Change password" }).click(),
    );

    await expect(passwordPanel(page).getByRole("alert")).toContainText(
      "at least 12 characters",
    );
  });

  // A server-action journey, so chromium only: the same server code through
  // three engines tests it three times. It also rotates a shared password,
  // which three engines would each expect to find in its original state.
  test("changes the password the account actually signs in with", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "server-action journey; also rotates shared mock state",
    );

    await signInAs(page, ROTATING.email, ROTATING.password);
    await page.goto("/settings");

    await fillBoth(page, ROTATING.password, ROTATING.next);
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Change password" }).click(),
    );

    await expect(passwordPanel(page).getByRole("status")).toContainText(
      "Password changed",
    );

    // The real assertion: the old password no longer works and the new one
    // does. Without this the test passes against an action that returns
    // cleanly and changes nothing.
    await page.goto("/sign-in");
    await page.fill("input[name='email']", ROTATING.email);
    await page.fill("input[name='password']", ROTATING.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await signInAs(page, ROTATING.email, ROTATING.next);
  });

  // Typing the wrong current password must not change anything: an unlocked
  // browser is not the account holder.
  test("refuses a wrong current password", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "server-action journey");

    await signIn(page);
    await page.goto("/settings");

    await fillBoth(page, "not-the-password", "a-long-enough-one");
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Change password" }).click(),
    );

    await expect(passwordPanel(page).getByRole("alert")).toContainText(
      "isn't your current password",
    );
  });
});

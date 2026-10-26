// tests/e2e/password-reset.spec.ts
//
// Forgot password → reset link → new password, in a real browser.
//
// The claim worth an e2e is the round trip: the link the email carries opens a
// page that verifies nothing until submit, the submit signs the user in, and
// the password the account signs in with afterwards is the new one. The mock
// auth server issues `recovery_<userId>` tokens, so the spec builds the link
// the email would carry instead of reading a mailbox.
import { expect, test, withServerAction } from "./_helpers/fixtures";

// Its own account: the mock's user store is shared by every spec in the run.
const RESETTING = {
  email: "reset@example.com",
  id: "00000000-0000-0000-0000-000000000003",
  password: "e2e-reset-1234567",
  next: "e2e-was-reset-890123",
};

test.describe("password reset", () => {
  // Not gated: a link and a form, which is markup and the accessibility tree.
  test("sign-in links to a form that asks for an email", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot your password?" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible();
  });

  test("a reset link sets a new password and signs the user in", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "server-action journey");

    await page.goto("/forgot-password");
    await page.fill("input[name='email']", RESETTING.email);
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Send reset link" }).click(),
    );
    await expect(page).toHaveURL(/\/forgot-password\?success=1/);

    const link = `/reset-password?token_hash=recovery_${RESETTING.id}&type=recovery`;
    await page.goto(link);
    await page.getByLabel("New password").fill(RESETTING.next);
    await page.getByRole("button", { name: "Save new password" }).click();
    await page.waitForURL(/\/transactions$/);

    // The link is spent: opening it again cannot set a password twice.
    await page.context().clearCookies();
    await page.goto(link);
    await page.getByLabel("New password").fill("e2e-another-345678");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/forgot-password\?error=reset-link-invalid/);

    // And the account now signs in with the new password, not the old one.
    await page.goto("/sign-in");
    await page.fill("input[name='email']", RESETTING.email);
    await page.fill("input[name='password']", RESETTING.next);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/transactions$/);
  });
});

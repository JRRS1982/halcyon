// tests/e2e/settings-data-privacy.spec.ts
//
// The confirmation gate in front of the destructive Settings actions, in a
// real browser.
//
// Worth an e2e rather than leaving it to the integration tests, because the
// claim that matters is about the whole path: which control the panel renders
// is decided server-side from the account's identities, travels to the client
// as a prop, and determines what the server action is handed back. A mocked
// client component cannot show that the three halves agree.
//
// Only the password branch is covered. Driving the code branch needs the mock
// auth server to issue and accept a one-time code, which is a larger change
// than this spec earns — the integration tests already pin that branch's
// behaviour.
import { expect, signIn, test } from "./_helpers/fixtures";

test.describe("Settings → your data", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("a password account is asked for its password, not a code", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "Clear my data" }).click();

    const panel = page.getByRole("alertdialog", {
      name: "Confirm clear data",
    });
    await expect(
      panel.getByLabel(/enter your password to confirm/i),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: /email me a code/i }),
    ).toHaveCount(0);
  });

  test("the confirm button stays disabled until the password is typed", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "Clear my data" }).click();

    const panel = page.getByRole("alertdialog", {
      name: "Confirm clear data",
    });
    const confirm = panel.getByRole("button", { name: "Clear my data" });
    await expect(confirm).toBeDisabled();

    await panel.getByLabel(/enter your password to confirm/i).fill("secret123");
    await expect(confirm).toBeEnabled();
  });
});

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
// Only the password branch is covered here. Driving the code branch needs the
// mock auth server to issue and accept a one-time code, which is a larger
// change than this spec earns — the integration tests pin the server half and
// the DataPrivacy unit tests pin the client half.
import { expect, signIn, test } from "./_helpers/fixtures";

// Deliberately NOT chromium-gated. These assert which form control renders and
// whether a button is enabled — label/htmlFor association and the accessibility
// tree — which CLAUDE.md says must never be gated, because engines genuinely
// differ there and a webkit-only regression would ship silently. The gate is
// for server-action journeys ending in a Prisma write; neither of these is one.
test.describe("Settings → your data", () => {
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

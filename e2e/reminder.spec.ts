// e2e/reminder.spec.ts
//
// The consent journey for the monthly reminder, in a real browser: switching it
// on in Settings, and switching it off from the link an email would carry.
//
// Worth an e2e rather than leaving it to the unit and integration tests,
// because the two claims that matter most are about the whole path — that a
// GET from a mail client doesn't unsubscribe anyone on its own, and that the
// unsubscribe link works with no session at all.
import { expect, signIn, test } from "./_helpers/fixtures";

const REMINDER = "Monthly reminder email";

/**
 * The switch's checkbox is visually hidden under its track, which is what
 * intercepts the pointer — so clicking the input directly times out. Clicking
 * the track is what a person actually does, and it drives the input because
 * both sit inside the same <label>.
 */
const flip = async (page: import("@playwright/test").Page, name: string) => {
  await page
    .getByRole("checkbox", { name })
    .locator("xpath=following-sibling::span")
    .click();
};

test.describe("Monthly reminder", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("is off until it is switched on, and mints a token when it is", async ({
    page,
    db,
  }) => {
    await signIn(page);
    await page.goto("/settings");

    const toggle = page.getByRole("checkbox", { name: REMINDER });
    await expect(toggle).not.toBeChecked();
    // The send day only matters once something is being sent, so it stays out
    // of the way until then.
    await expect(page.getByRole("combobox", { name: /send on/i })).toHaveCount(
      0,
    );

    await flip(page, REMINDER);
    await expect(toggle).toBeChecked();
    await expect(
      page.getByRole("combobox", { name: /send on/i }),
    ).toBeVisible();

    await expect
      .poll(async () => {
        const row = await db.userSettings.findFirst({
          select: { monthlyReminderEnabled: true, unsubscribeToken: true },
        });
        return {
          enabled: row?.monthlyReminderEnabled,
          hasToken: Boolean(row?.unsubscribeToken),
        };
      })
      // The token has to exist before any email could reference it — the cron
      // skips a subscription without one rather than sending mail with no way
      // out of it.
      .toEqual({ enabled: true, hasToken: true });
  });

  test("remembers the chosen send day", async ({ page, db }) => {
    await signIn(page);
    await page.goto("/settings");
    await flip(page, REMINDER);

    await page
      .getByRole("combobox", { name: /send on/i })
      .selectOption({ label: "15th of the month" });

    await expect
      .poll(async () => {
        const row = await db.userSettings.findFirst({
          select: { monthlyReminderDay: true },
        });
        return row?.monthlyReminderDay;
      })
      .toBe(15);

    await page.reload();
    await expect(page.getByRole("combobox", { name: /send on/i })).toHaveValue(
      "15",
    );
  });

  test.describe("the link in the email", () => {
    const enable = async (page: import("@playwright/test").Page) => {
      await signIn(page);
      await page.goto("/settings");
      await flip(page, REMINDER);
      await expect(
        page.getByRole("combobox", { name: /send on/i }),
      ).toBeVisible();
    };

    test("asks first, and unsubscribes with no session", async ({
      page,
      browser,
      db,
    }) => {
      await enable(page);

      // The toggle persists through a server action, so the token appears a
      // beat after the checkbox settles.
      await expect
        .poll(async () => {
          const row = await db.userSettings.findFirst({
            select: { unsubscribeToken: true },
          });
          return Boolean(row?.unsubscribeToken);
        })
        .toBe(true);
      const { unsubscribeToken: token } =
        await db.userSettings.findFirstOrThrow({
          select: { unsubscribeToken: true },
        });

      // A fresh context: someone opening a link from their inbox is often not
      // signed in, and making them log in to stop email they didn't want would
      // be a dark pattern.
      const inbox = await browser.newContext();
      const opened = await inbox.newPage();
      await opened.goto(`/unsubscribe?token=${encodeURIComponent(token)}`);

      await expect(
        opened.getByRole("heading", { name: /stop monthly reminders\?/i }),
      ).toBeVisible();

      // Mail clients, link scanners and prefetchers all fetch URLs without a
      // human deciding to. Opening the page must change nothing.
      expect(
        (
          await db.userSettings.findFirst({
            select: { monthlyReminderEnabled: true },
          })
        )?.monthlyReminderEnabled,
      ).toBe(true);

      await opened.getByRole("button", { name: /^unsubscribe$/i }).click();
      await expect(
        opened.getByRole("heading", { name: /you're unsubscribed/i }),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const row = await db.userSettings.findFirst({
            select: { monthlyReminderEnabled: true },
          });
          return row?.monthlyReminderEnabled;
        })
        .toBe(false);

      await inbox.close();
    });

    test("says something calm when the token means nothing", async ({
      browser,
    }) => {
      const inbox = await browser.newContext();
      const opened = await inbox.newPage();

      await opened.goto("/unsubscribe?token=not-a-real-token");

      // Framed as an expired link rather than an error the reader caused: the
      // likeliest cause is a deleted account, which is a state they wanted.
      await expect(
        opened.getByRole("heading", { name: /that link has expired/i }),
      ).toBeVisible();

      await inbox.close();
    });
  });
});

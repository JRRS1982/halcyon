import {
  enabledSubscriptions,
  ensureUnsubscribeToken,
  markReminderSent,
  unsubscribeByToken,
} from "@/lib/email/subscriptions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const settings = () =>
  prisma.userSettings.findUniqueOrThrow({ where: { userId: TEST_USER_ID } });

const enable = (day = 8) =>
  prisma.userSettings.update({
    where: { userId: TEST_USER_ID },
    data: { monthlyReminderEnabled: true, monthlyReminderDay: day },
  });

describe("reminder subscriptions (integration)", () => {
  describe("defaults", () => {
    // The single most important property of this feature: a user who never
    // asked for email does not get email. Asserted against the real column
    // defaults rather than the Prisma schema file.
    it("leaves a new account unsubscribed, with no token", async () => {
      const row = await settings();
      expect(row.monthlyReminderEnabled).toBe(false);
      expect(row.unsubscribeToken).toBeNull();
      expect(row.monthlyReminderSentAt).toBeNull();
    });

    it("is invisible to the cron until it is switched on", async () => {
      expect(await enabledSubscriptions()).toEqual([]);
    });
  });

  describe("ensureUnsubscribeToken", () => {
    it("mints a token and returns the same one on a second call", async () => {
      const first = await ensureUnsubscribeToken(TEST_USER_ID);
      expect(first).toMatch(/^[\w-]{20,}$/);

      // Re-minting would strand every link already sitting in someone's inbox.
      expect(await ensureUnsubscribeToken(TEST_USER_ID)).toBe(first);
    });
  });

  describe("unsubscribeByToken", () => {
    it("turns the reminder off for the token's owner", async () => {
      await enable();
      const token = await ensureUnsubscribeToken(TEST_USER_ID);

      expect(await unsubscribeByToken(token)).toBe("unsubscribed");
      expect((await settings()).monthlyReminderEnabled).toBe(false);
    });

    // Mail clients and corporate link scanners fetch the same URL more than
    // once. The second click must be a calm no-op, not an error page.
    it("reports already-off on a repeat click, and keeps it off", async () => {
      await enable();
      const token = await ensureUnsubscribeToken(TEST_USER_ID);
      await unsubscribeByToken(token);

      expect(await unsubscribeByToken(token)).toBe("already-off");
      expect((await settings()).monthlyReminderEnabled).toBe(false);
    });

    it("does not keep the token, so re-enabling reuses the same link", async () => {
      await enable();
      const token = await ensureUnsubscribeToken(TEST_USER_ID);
      await unsubscribeByToken(token);

      expect((await settings()).unsubscribeToken).toBe(token);
    });

    it.each([
      ["an unrecognised token", "not-a-real-token"],
      ["an empty token", ""],
    ])("reports unknown for %s, and changes nothing", async (_label, token) => {
      await enable();

      expect(await unsubscribeByToken(token)).toBe("unknown");
      expect((await settings()).monthlyReminderEnabled).toBe(true);
    });
  });

  describe("enabledSubscriptions", () => {
    it("returns the row once enabled, with what the schedule needs", async () => {
      await enable(15);
      await ensureUnsubscribeToken(TEST_USER_ID);

      const [row, ...rest] = await enabledSubscriptions();
      expect(rest).toEqual([]);
      expect(row).toMatchObject({
        userId: TEST_USER_ID,
        monthlyReminderEnabled: true,
        monthlyReminderDay: 15,
        monthlyReminderSentAt: null,
        unsubscribeToken: expect.any(String),
      });
    });

    it("drops the row again the moment it is switched off", async () => {
      await enable();
      await prisma.userSettings.update({
        where: { userId: TEST_USER_ID },
        data: { monthlyReminderEnabled: false },
      });

      expect(await enabledSubscriptions()).toEqual([]);
    });
  });

  describe("markReminderSent", () => {
    it("stamps the send, which is what stops a same-month repeat", async () => {
      await enable();
      const sentAt = new Date("2026-09-08T09:00:00.000Z");

      await markReminderSent(TEST_USER_ID, sentAt);

      expect((await settings()).monthlyReminderSentAt).toEqual(sentAt);
    });
  });

  // The check constraint is the last line of defence behind the zod schema and
  // the four-option select: a bad day would schedule mail for a date that some
  // months don't have.
  describe("the send-day constraint", () => {
    it("refuses a day that isn't one of the four offered", async () => {
      await expect(
        prisma.userSettings.update({
          where: { userId: TEST_USER_ID },
          data: { monthlyReminderDay: 31 },
        }),
      ).rejects.toThrow();
    });
  });
});

import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

/**
 * The cron job's orchestration, against a real database.
 *
 * Only the two outbound edges are mocked — Resend and the Supabase admin API —
 * because they are the parts we don't own. The query, the due filter, the
 * unsubscribe-token guard and the sent stamp are all the real thing, which is
 * where the bugs would be: sending twice, sending to nobody, or sending mail
 * with no way out of it.
 */

const sendEmail = jest.fn();
const getUserById = jest.fn();

jest.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: (id: string) => getUserById(id) } },
  }),
}));

// requireActual so DATABASE_URL survives for Prisma — only the optional mail
// block is replaced.
jest.mock("@/lib/env", () => ({
  ...jest.requireActual("@/lib/env"),
  emailEnv: {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Balanced Money <reminders@balanced.money>",
    SITE_URL: "https://balanced.money",
    CRON_SECRET: "cron-test-secret",
  },
}));

import { GET } from "@/app/api/cron/monthly-reminder/route";
import { ensureUnsubscribeToken } from "@/lib/email/subscriptions";

const SEND_DAY = 8;
const ON_THE_DAY = new Date("2026-09-08T09:00:00.000Z");

/**
 * Only Date is faked.
 *
 * The route reads the clock, so without this the suite would pass or skip
 * depending on the calendar date it happened to run on — worthless in CI.
 * Everything else is left real: Prisma's pool and the driver lean on timers,
 * and faking those deadlocks the query rather than failing it.
 */
const FAKE_DATE_ONLY = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "setImmediate",
  "clearImmediate",
  "nextTick",
  "queueMicrotask",
  "performance",
  "hrtime",
] as const;

const atTime = (now: Date) =>
  jest.useFakeTimers({ now, doNotFake: [...FAKE_DATE_ONLY] });

const call = (secret = "cron-test-secret") =>
  GET(
    new Request("https://balanced.money/api/cron/monthly-reminder", {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );

const subscribe = () =>
  prisma.userSettings.update({
    where: { userId: TEST_USER_ID },
    data: {
      monthlyReminderEnabled: true,
      monthlyReminderDay: SEND_DAY,
      monthlyReminderSentAt: null,
    },
  });

const settings = () =>
  prisma.userSettings.findUniqueOrThrow({ where: { userId: TEST_USER_ID } });

describe("monthly reminder cron (integration)", () => {
  beforeEach(() => {
    atTime(ON_THE_DAY);
    sendEmail.mockReset().mockResolvedValue({ ok: true, id: "msg_1" });
    getUserById
      .mockReset()
      .mockResolvedValue({ data: { user: { email: "user@example.com" } } });
  });

  afterEach(() => jest.useRealTimers());

  it("refuses without the bearer, and sends nothing", async () => {
    await subscribe();
    await ensureUnsubscribeToken(TEST_USER_ID);

    const response = await call("wrong-secret");

    expect(response.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when nobody has opted in", async () => {
    const response = await call();

    expect(await response.json()).toMatchObject({ due: 0, sent: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  describe("with a subscriber due today", () => {
    beforeEach(async () => {
      await subscribe();
      await ensureUnsubscribeToken(TEST_USER_ID);
    });

    it("sends once, to the address from Supabase Auth", async () => {
      const response = await call();

      expect(await response.json()).toMatchObject({ sent: 1, failures: [] });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail.mock.calls[0][0]).toMatchObject({
        to: "user@example.com",
        subject: "August 2026 is ready to log",
      });
    });

    it("includes an unsubscribe URL built from the stored token", async () => {
      await call();

      const token = (await settings()).unsubscribeToken;
      expect(sendEmail.mock.calls[0][0].unsubscribeUrl).toBe(
        `https://balanced.money/unsubscribe?token=${token}`,
      );
    });

    it("stamps the send", async () => {
      await call();

      expect((await settings()).monthlyReminderSentAt).toEqual(ON_THE_DAY);
    });

    // The cron runs daily. Without the stamp this would mail the same person
    // every day of the retry window.
    it("does not send again on a second run the same day", async () => {
      await call();
      sendEmail.mockClear();

      const second = await call();

      expect(await second.json()).toMatchObject({ due: 0, sent: 0 });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("does not send again the next day, inside the retry window", async () => {
      await call();
      sendEmail.mockClear();
      atTime(new Date("2026-09-09T09:00:00.000Z"));

      await call();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("sends again the following month", async () => {
      await call();
      sendEmail.mockClear();
      atTime(new Date("2026-10-08T09:00:00.000Z"));

      const response = await call();

      expect(await response.json()).toMatchObject({ sent: 1 });
      expect(sendEmail.mock.calls[0][0].subject).toBe(
        "September 2026 is ready to log",
      );
    });

    it("leaves the send unstamped when the provider rejects it", async () => {
      sendEmail.mockResolvedValue({ ok: false, error: "422 bad address" });

      const response = await call();

      expect((await response.json()).sent).toBe(0);
      expect((await settings()).monthlyReminderSentAt).toBeNull();
    });

    // Unstamped means the next daily run picks them back up, rather than the
    // month being silently lost to a transient provider failure.
    it("retries the next day after a failure", async () => {
      sendEmail.mockResolvedValueOnce({ ok: false, error: "503" });
      await call();

      sendEmail.mockResolvedValue({ ok: true, id: "msg_2" });
      atTime(new Date("2026-09-09T09:00:00.000Z"));
      const retry = await call();

      expect(await retry.json()).toMatchObject({ sent: 1 });
    });

    it("gives up once the retry window closes", async () => {
      sendEmail.mockResolvedValue({ ok: false, error: "503" });
      await call();
      sendEmail.mockReset().mockResolvedValue({ ok: true, id: "msg_3" });

      atTime(new Date("2026-09-11T09:00:00.000Z"));
      const late = await call();

      expect(await late.json()).toMatchObject({ due: 0, sent: 0 });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    // An email nobody can unsubscribe from is worse than no email, so a
    // subscription without a token is skipped rather than sent.
    it("skips a subscription with no unsubscribe token", async () => {
      await prisma.userSettings.update({
        where: { userId: TEST_USER_ID },
        data: { unsubscribeToken: null },
      });

      const response = await call();

      expect(sendEmail).not.toHaveBeenCalled();
      expect((await response.json()).failures).toEqual([
        `${TEST_USER_ID}: no unsubscribe token`,
      ]);
    });

    it("skips a user Supabase Auth has no address for", async () => {
      getUserById.mockResolvedValue({ data: { user: null }, error: null });

      const response = await call();

      expect(sendEmail).not.toHaveBeenCalled();
      expect((await response.json()).failures).toEqual([
        `${TEST_USER_ID}: no address`,
      ]);
    });

    // The response is written to Vercel's logs, so it names user ids only.
    it("keeps email addresses out of the response", async () => {
      getUserById.mockResolvedValue({ data: { user: null }, error: null });

      const body = JSON.stringify(await (await call()).json());

      expect(body).not.toContain("user@example.com");
    });
  });

  it("sends nothing to someone who unsubscribed", async () => {
    await subscribe();
    await ensureUnsubscribeToken(TEST_USER_ID);
    await prisma.userSettings.update({
      where: { userId: TEST_USER_ID },
      data: { monthlyReminderEnabled: false },
    });

    const response = await call();

    expect(await response.json()).toMatchObject({ due: 0, sent: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

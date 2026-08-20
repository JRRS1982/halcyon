// src/__tests__/email/reminder.test.ts
import {
  REMINDER_DAYS,
  REMINDER_RETRY_DAYS,
  type ReminderSubscription,
  buildReminder,
  isReminderDue,
  previousMonthLabel,
  reminderDaySchema,
} from "@/lib/email/reminder";

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

const subscription = (
  overrides: Partial<ReminderSubscription> = {},
): ReminderSubscription => ({
  userId: "u1",
  monthlyReminderEnabled: true,
  monthlyReminderDay: 8,
  monthlyReminderSentAt: null,
  unsubscribeToken: "tok",
  transactionsEnabled: true,
  ...overrides,
});

describe("isReminderDue", () => {
  test("sends on the chosen day when it has never been sent", () => {
    expect(isReminderDue(subscription(), at("2026-09-08"))).toBe(true);
  });

  test("does not send to someone who never opted in", () => {
    expect(
      isReminderDue(
        subscription({ monthlyReminderEnabled: false }),
        at("2026-09-08"),
      ),
    ).toBe(false);
  });

  test("does not send before the chosen day", () => {
    expect(isReminderDue(subscription(), at("2026-09-07"))).toBe(false);
  });

  // The whole point of the stamp: the cron runs daily, so without this a
  // subscriber inside the retry window would be mailed every day.
  test("does not send twice in the same calendar month", () => {
    const sent = subscription({ monthlyReminderSentAt: at("2026-09-08") });
    expect(isReminderDue(sent, at("2026-09-09"))).toBe(false);
    expect(isReminderDue(sent, at("2026-09-10"))).toBe(false);
  });

  test("sends again the following month", () => {
    const sent = subscription({ monthlyReminderSentAt: at("2026-09-08") });
    expect(isReminderDue(sent, at("2026-10-08"))).toBe(true);
  });

  // A December stamp against a January run: same month number, different year.
  // Comparing only getUTCMonth() would silently skip January every year.
  test("sends again across a year boundary", () => {
    const sent = subscription({
      monthlyReminderDay: 1,
      monthlyReminderSentAt: at("2026-12-01"),
    });
    expect(isReminderDue(sent, at("2027-01-01"))).toBe(true);
  });

  describe("retry window", () => {
    test("still sends within the window when the day was missed", () => {
      for (let offset = 0; offset <= REMINDER_RETRY_DAYS; offset++) {
        const day = 8 + offset;
        expect(isReminderDue(subscription(), at(`2026-09-0${day}`))).toBe(true);
      }
    });

    test("gives up once the window closes, rather than mailing late", () => {
      const day = 8 + REMINDER_RETRY_DAYS + 1;
      expect(isReminderDue(subscription(), at(`2026-09-${day}`))).toBe(false);
    });
  });
});

describe("reminderDaySchema", () => {
  test("accepts each offered day", () => {
    for (const day of REMINDER_DAYS) {
      expect(reminderDaySchema.parse(day)).toBe(day);
    }
  });

  // The select only offers four values, so anything else arrived by a hand-made
  // request. The database has the same constraint.
  test.each([0, 5, 29, 31, 32])("rejects %s", (day) => {
    expect(reminderDaySchema.safeParse(day).success).toBe(false);
  });
});

describe("previousMonthLabel", () => {
  test("names the month that just finished", () => {
    expect(previousMonthLabel(at("2026-09-08"))).toBe("August 2026");
  });

  test("rolls back into the previous year in January", () => {
    expect(previousMonthLabel(at("2027-01-01"))).toBe("December 2026");
  });
});

describe("buildReminder", () => {
  const message = buildReminder({
    siteUrl: "https://balanced.money/",
    unsubscribeToken: "tok-123",
    now: at("2026-09-08"),
    transactionsEnabled: true,
  });

  test("is about the month that just finished", () => {
    expect(message.subject).toBe("August 2026 is ready to log");
  });

  // The reason this email carries no figures is a privacy decision, not a
  // stylistic one — so it is asserted rather than left to a reviewer to notice
  // when someone later adds "a small summary".
  //
  // Checked against what the reader actually sees: the HTML is stripped of tags
  // first, because the inline styles are full of decimals (line-height:1.6) and
  // a raw-source check would either fail on those or be loosened until it
  // caught nothing.
  const visibleText = (html: string) =>
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  test.each([
    ["plain text", message.text],
    ["rendered HTML", visibleText(message.html)],
  ])("carries no figures in the %s", (_label, body) => {
    // An amount with a currency symbol.
    expect(body).not.toMatch(/[£$€]\s?\d/);
    // A thousands separator or a decimal — 1,234 or 12.34. A bare year like
    // "August 2026" has neither, which is why this is the shape being matched
    // rather than "any run of digits".
    expect(body).not.toMatch(/\d[.,]\d/);
  });

  test("both bodies carry a working unsubscribe link", () => {
    const expected = "https://balanced.money/unsubscribe?token=tok-123";
    expect(message.unsubscribeUrl).toBe(expected);
    expect(message.text).toContain(expected);
    expect(message.html).toContain(expected);
  });

  // A relative link in an inbox goes nowhere, and a doubled slash breaks the
  // token match on some clients that normalise URLs.
  test("builds absolute links without a doubled slash", () => {
    expect(message.html).toContain("https://balanced.money/transactions");
    expect(message.html).not.toContain("balanced.money//");
  });

  // The CTA lands on the work, not on the sign-in form: middleware sends a
  // signed-out visitor through /sign-in?next=... and back, and a signed-in one
  // straight there. Which page IS the work depends on the user's mode.
  test("the call to action deep-links to the import flow when transactions are on", () => {
    expect(message.text).toContain("https://balanced.money/transactions");
    expect(message.html).toContain("https://balanced.money/transactions");
  });

  test("the call to action deep-links to the budget sheet for manual users", () => {
    const manual = buildReminder({
      siteUrl: "https://balanced.money",
      unsubscribeToken: "tok-123",
      now: at("2026-09-08"),
      transactionsEnabled: false,
    });
    expect(manual.text).toContain("https://balanced.money/budget");
    expect(manual.html).toContain("https://balanced.money/budget");
    expect(manual.html).not.toContain("/transactions");
  });

  // /about does not exist — the guide lives at /guide. Asserted because the
  // 404 shipped once already.
  test("the guide link points at the route that exists", () => {
    expect(message.text).toContain("https://balanced.money/guide");
    expect(message.html).toContain("https://balanced.money/guide");
    expect(message.text).not.toContain("/about");
    expect(message.html).not.toContain("/about");
  });

  test("says why the reader is receiving it", () => {
    expect(message.text).toMatch(/because you turned on monthly reminders/i);
    expect(message.html).toMatch(/because you turned on monthly reminders/i);
  });
});

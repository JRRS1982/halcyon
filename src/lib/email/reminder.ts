import { z } from "zod";

/**
 * The monthly reminder, as pure functions: when it is due, and what it says.
 *
 * Everything here is deliberately free of Prisma, Resend and `new Date()` —
 * the cron route supplies "now" and the rows, so the two things most likely to
 * be wrong (a date boundary, a sentence) are unit-testable without a network
 * or a clock.
 */

// The four offered send days. Statements close on different days depending on
// the bank, so a single fixed date would reach a lot of people before there was
// anything to import — which teaches them to ignore it. Four choices covers the
// common cycles without turning into a date picker.
export const REMINDER_DAYS = [1, 8, 15, 22] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

export const reminderDaySchema = z.coerce
  .number()
  .refine((n): n is ReminderDay => REMINDER_DAYS.includes(n as ReminderDay), {
    message: "Not an offered reminder day",
  });

export const REMINDER_DAY_LABELS: Record<ReminderDay, string> = {
  1: "1st of the month",
  8: "8th of the month",
  15: "15th of the month",
  22: "22nd of the month",
};

export type ReminderSubscription = {
  userId: string;
  monthlyReminderEnabled: boolean;
  monthlyReminderDay: number;
  monthlyReminderSentAt: Date | null;
  unsubscribeToken: string | null;
};

/**
 * How many days past the chosen one the job will still send.
 *
 * Without this, a send that fails — a Resend blip, a rate limit, a deploy
 * mid-job — costs the user that whole month, because tomorrow is no longer
 * their day. With it, the next daily run picks them back up. Two days is enough
 * to cover a transient outage without the mail turning up so late that it reads
 * as random.
 */
export const REMINDER_RETRY_DAYS = 2;

/**
 * Whether this subscription should be sent to on `now`.
 *
 * The cron fires daily and asks this of every enabled row, so the already-sent
 * check is what makes a second run — a retry, a manual trigger, tomorrow's
 * scheduled run inside the retry window — a no-op. Compared by calendar month
 * rather than by a 30-day window: the promise is "once a month", and a rolling
 * window would drift a day earlier each time until it crossed back into the
 * previous month and sent twice.
 *
 * UTC throughout. The user's timezone would only shift which side of midnight
 * the mail lands on, and a reminder is not time-of-day sensitive; mixing zones
 * here would let the "is it the 8th yet" and "did we already send this month"
 * comparisons disagree at the edges.
 */
export function isReminderDue(
  subscription: ReminderSubscription,
  now: Date,
): boolean {
  if (!subscription.monthlyReminderEnabled) return false;

  const today = now.getUTCDate();
  const chosen = subscription.monthlyReminderDay;
  if (today < chosen || today > chosen + REMINDER_RETRY_DAYS) return false;

  const sentAt = subscription.monthlyReminderSentAt;
  if (!sentAt) return true;

  return (
    sentAt.getUTCFullYear() !== now.getUTCFullYear() ||
    sentAt.getUTCMonth() !== now.getUTCMonth()
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The month the reminder is about: the one that just finished. */
export function previousMonthLabel(now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month === 0
    ? `${MONTHS[11]} ${year - 1}`
    : `${MONTHS[month - 1]} ${year}`;
}

export type ReminderMessage = {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
};

/**
 * The email itself.
 *
 * It carries no figures — not a balance, not a total, not a category. Financial
 * data is not special-category data under UK GDPR Art. 9, so there is no rule
 * against it, but Art. 32 asks for security appropriate to the risk and a
 * mailbox is a poor place for it: it rests on servers we don't control, it gets
 * forwarded, it previews on lock screens, and a mis-send becomes a notifiable
 * breach. Saying only "your month is ready" keeps the mail provider out of
 * scope as a processor of anything but an email address, and the numbers stay
 * behind a login where they belong.
 */
export function buildReminder({
  siteUrl,
  unsubscribeToken,
  now,
}: {
  siteUrl: string;
  unsubscribeToken: string;
  now: Date;
}): ReminderMessage {
  const base = siteUrl.replace(/\/$/, "");
  const month = previousMonthLabel(now);
  const signInUrl = `${base}/sign-in`;
  const unsubscribeUrl = `${base}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const guideUrl = `${base}/about`;

  const subject = `${month} is ready to log`;

  const text = [
    `${month} is done, so your statement should be available to download.`,
    "",
    "The usual five minutes: import it, categorise what came in, check the",
    "budget, update your balances, then look at the dashboard.",
    "",
    `Sign in: ${signInUrl}`,
    `How it works: ${guideUrl}`,
    "",
    "---",
    "You're getting this because you turned on monthly reminders in Balanced",
    "Money. Nothing about your finances is in this email.",
    `Stop these reminders: ${unsubscribeUrl}`,
  ].join("\n");

  // Inline styles and a table-free single column: every email client strips
  // <style> blocks or ignores them, and the ones that don't disagree about
  // flexbox. This renders the same in Gmail, Outlook and Mail without a build
  // step or a templating dependency.
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#717171;">Balanced Money</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;">${month} is ready to log</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d3d3d;">${month} is done, so your statement should be available to download.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d3d3d;">The usual five minutes: import it, categorise what came in, check the budget, update your balances, then look at the dashboard.</p>
      <p style="margin:0 0 32px;">
        <a href="${signInUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:4px;font-size:14px;">Sign in to Balanced Money</a>
      </p>
      <p style="margin:0 0 32px;font-size:14px;line-height:1.6;color:#3d3d3d;">Not sure what to do first? <a href="${guideUrl}" style="color:#3d3d3d;">Read the guide</a>.</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#717171;">
        You're getting this because you turned on monthly reminders in Balanced Money. Nothing about your finances is in this email.<br />
        <a href="${unsubscribeUrl}" style="color:#717171;">Stop these reminders</a>
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html, unsubscribeUrl };
}

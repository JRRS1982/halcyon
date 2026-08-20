import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { buildReminder, isReminderDue } from "@/lib/email/reminder";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import {
  enabledSubscriptions,
  markReminderSent,
} from "@/lib/email/subscriptions";
import { emailEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The monthly reminder job. Vercel Cron hits this once a day; it sends to the
 * subscriptions whose chosen day is today and that haven't already had this
 * month's mail.
 *
 * Daily rather than monthly because users pick their own send day — one
 * schedule covers all four, and the "is it due" decision lives in code that can
 * be tested rather than in a crontab expression.
 */

// Node, not edge: Prisma and the Supabase admin client both need it.
export const runtime = "nodejs";
// Never cached, never prerendered — it has side effects and reads the clock.
export const dynamic = "force-dynamic";

/**
 * Constant-time bearer check against CRON_SECRET.
 *
 * Vercel attaches `Authorization: Bearer $CRON_SECRET` to scheduled
 * invocations. If the secret isn't set we refuse rather than run: an
 * unauthenticated endpoint that sends mail to every subscriber is a way to get
 * a domain blocklisted, and "no secret configured" must not read as "no
 * authentication required".
 */
function isAuthorized(request: Request): boolean {
  const secret = emailEnv.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // timingSafeEqual throws on a length mismatch, which is itself a (safe)
  // leak of length only.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured() || !emailEnv.SITE_URL) {
    // A deploy without mail configured is a valid state (previews, staging), so
    // this is a no-op rather than an error — but it says so, because a silent
    // 200 here would look identical to "nobody was due".
    return NextResponse.json({ skipped: "email not configured" });
  }
  const siteUrl = emailEnv.SITE_URL;

  const now = new Date();
  const due = (await enabledSubscriptions()).filter((subscription) =>
    isReminderDue(subscription, now),
  );

  const admin = createAdminClient();
  let sent = 0;
  const failures: string[] = [];

  // Sequential, not Promise.all: Resend rate-limits, and the daily volume here
  // is a handful. A failure for one subscriber must not abort the rest, so each
  // is caught and recorded.
  for (const subscription of due) {
    // The email address lives in Supabase Auth, not in our tables — the app has
    // never stored it, and this job is not a reason to start.
    const { data, error } = await admin.auth.admin.getUserById(
      subscription.userId,
    );
    const address = data?.user?.email;
    if (error || !address) {
      failures.push(`${subscription.userId}: no address`);
      continue;
    }

    // Enabling the reminder mints the token, so this should always be present.
    // If it isn't, skipping is right: an email with no working unsubscribe link
    // is the one thing worse than no email.
    if (!subscription.unsubscribeToken) {
      failures.push(`${subscription.userId}: no unsubscribe token`);
      continue;
    }

    const message = buildReminder({
      siteUrl,
      unsubscribeToken: subscription.unsubscribeToken,
      now,
      transactionsEnabled: subscription.transactionsEnabled,
    });

    const result = await sendEmail({
      to: address,
      subject: message.subject,
      text: message.text,
      html: message.html,
      unsubscribeUrl: message.unsubscribeUrl,
    });

    if (!result.ok) {
      failures.push(`${subscription.userId}: ${result.error}`);
      continue;
    }

    // Stamped only after a successful send. Combined with the retry window in
    // isReminderDue, a provider outage means tomorrow's run picks this
    // subscriber back up rather than the month being lost.
    await markReminderSent(subscription.userId, now);
    sent += 1;
  }

  // User ids, not addresses: this response ends up in Vercel's logs.
  return NextResponse.json({ due: due.length, sent, failures });
}

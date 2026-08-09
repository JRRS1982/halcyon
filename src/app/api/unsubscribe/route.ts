import { unsubscribeByToken } from "@/lib/email/subscriptions";
import { NextResponse } from "next/server";

/**
 * RFC 8058 one-click unsubscribe.
 *
 * This is what Gmail and Outlook POST to when the reader uses the unsubscribe
 * control the client renders next to the sender — the one advertised by the
 * List-Unsubscribe headers in src/lib/email/send.ts. It is a machine endpoint:
 * no page, no session, no confirmation step, because the confirmation already
 * happened in the mail client's own UI.
 *
 * The human-facing route is /unsubscribe, which shows what will happen first.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const outcome = await unsubscribeByToken(token);

  // 200 even for an unrecognised token. Mail clients retry and then warn the
  // reader on a failure, and "we don't recognise this" is not something the
  // reader can act on — from their side the outcome is the same either way: no
  // more mail. Guessing tokens gains nothing beyond turning off a reminder.
  return NextResponse.json({ outcome });
}

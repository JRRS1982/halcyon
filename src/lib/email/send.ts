import { emailEnv } from "@/lib/env";

/**
 * Sending, via Resend's REST API.
 *
 * A plain fetch rather than the `resend` SDK: the whole surface we use is one
 * POST with a JSON body, and the SDK would be a dependency to track, audit and
 * upgrade for the sake of a wrapper around that. If we ever need batching,
 * attachments or webhooks, that's the point to reconsider.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Surfaced as List-Unsubscribe, so clients can offer their own opt-out. */
  unsubscribeUrl?: string;
};

/**
 * Whether sending is configured at all.
 *
 * The mail env vars are optional (see env.ts), so local dev, CI and preview
 * deploys run without them. Callers check this and skip rather than throwing —
 * an unconfigured environment should be quiet, not broken.
 */
export function isEmailConfigured(): boolean {
  return Boolean(emailEnv.RESEND_API_KEY && emailEnv.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const apiKey = emailEnv.RESEND_API_KEY;
  const from = emailEnv.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email is not configured" };

  // List-Unsubscribe lets Gmail and Outlook render their own unsubscribe
  // control next to the sender, which is both a deliverability signal and a
  // faster exit than hunting for the link in the footer. One-Click means the
  // client can POST it without the user leaving their inbox.
  const headers: Record<string, string> = email.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : {};

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers,
      }),
    });

    if (!response.ok) {
      // Resend puts the reason in the body; the status alone doesn't say
      // whether this is a bad address (skip it) or a bad key (fix the deploy).
      const body = await response.text().catch(() => "");
      return { ok: false, error: `${response.status} ${body}`.trim() };
    }

    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "" };
  }
}

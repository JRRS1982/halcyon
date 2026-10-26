"use server";

import { redirect } from "next/navigation";
import type { AuthNoticeCode } from "@/lib/auth/authNotices";
import { callbackOrigin } from "@/lib/auth/callbackOrigin";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit, type RateLimitVerdict } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// A code, never a message: see lib/auth/authNotices.ts.
function failRequest(code: AuthNoticeCode): never {
  redirect(`/forgot-password?error=${code}`);
}

// Every request sends an email, so like sign-up this fails closed: with the
// store down, pausing resets is cheaper than an unbounded stream of mail.
const rejectionFor = (verdict: RateLimitVerdict): AuthNoticeCode | null => {
  if (verdict === "limited") return "too-many-attempts";
  if (verdict === "unavailable") return "reset-unavailable";
  return null;
};

export const requestPasswordReset = async (formData: FormData) => {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) failRequest("invalid-email");

  // Two buckets, as on sign-up: the IP bounds one sender, the address bounds
  // how many reset emails any one inbox can be sent, whatever the IPs.
  const rejection =
    rejectionFor(await checkRateLimit("password-reset", await clientIp())) ??
    rejectionFor(
      await checkRateLimit("password-reset-address", parsed.data.email),
    );
  if (rejection) failRequest(rejection);

  // The link itself is built by the Supabase "Reset password" template from
  // {{ .RedirectTo }} and {{ .TokenHash }}, landing on /reset-password with a
  // token rather than a PKCE code — see docs/features/auth.md for why.
  const origin = await callbackOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/reset-password` },
  );

  // The same answer whatever happened. Supabase answers an unknown address
  // without error, but anything it does say stays in the log: a different
  // page for a failure would let anyone test which addresses have accounts.
  if (error) {
    log.warn("Password reset request not sent", {
      status: error.status,
      message: error.message,
    });
  }

  redirect("/forgot-password?success=1");
};

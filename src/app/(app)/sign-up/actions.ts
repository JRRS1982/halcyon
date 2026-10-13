"use server";

import { redirect } from "next/navigation";
import type { AuthNoticeCode } from "@/lib/auth/authNotices";
import { checkPasswordBreach } from "@/lib/auth/breachedPassword";
import { callbackOrigin } from "@/lib/auth/callbackOrigin";
import { signUpSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit, type RateLimitVerdict } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// A code, never a message: see lib/auth/authNotices.ts.
function failSignUp(code: AuthNoticeCode): never {
  redirect(`/sign-up?error=${code}`);
}

// Every sign-up sends a confirmation email, so this is the one place the
// limiter fails closed (see src/lib/rateLimit): with the store down, pausing
// new sign-ups is cheaper than an unbounded stream of outbound mail.
const rejectionFor = (verdict: RateLimitVerdict): AuthNoticeCode | null => {
  if (verdict === "limited") return "too-many-attempts";
  if (verdict === "unavailable") return "signup-unavailable";
  return null;
};

export const signUp = async (formData: FormData) => {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    failSignUp(
      parsed.error.issues[0]?.path[0] === "email"
        ? "invalid-email"
        : "password-too-short",
    );
  }

  // Two buckets: the client's IP bounds one attacker, the address bounds how
  // many confirmation emails any inbox can be sent, whatever the IPs.
  const ipRejection = rejectionFor(
    await checkRateLimit("sign-up", await clientIp()),
  );
  const addressRejection = rejectionFor(
    await checkRateLimit("sign-up-address", parsed.data.email),
  );
  const rejection = ipRejection ?? addressRejection;
  if (rejection) {
    failSignUp(rejection);
  }

  // A password already in a breach corpus is the one credential-stuffing
  // actually uses, and no rate limit helps when the guess is already correct.
  // "unknown" means HIBP was unreachable: logged, and allowed through. Refusing
  // a probably-fine password because someone else's service is down is the
  // worse failure, and the same call the rate limiter makes for sign-in.
  const breach = await checkPasswordBreach(parsed.data.password);
  if (breach === "breached") {
    failSignUp("password-breached");
  }
  if (breach === "unknown") {
    log.warn("Breached-password check unavailable; allowing sign-up");
  }

  const origin = await callbackOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  // Never surface the provider's message to the client: for an address that
  // already has an account Supabase returns "User already registered", which
  // turns sign-up into an email-enumeration oracle. Log it server-side for
  // observability and always land on the same "check your email" page, so an
  // existing address and a new one are indistinguishable from the outside.
  if (error) {
    log.warn("Sign-up did not create a session", { err: error });
  }

  redirect("/sign-up?success=1");
};

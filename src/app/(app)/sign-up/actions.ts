"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signUpSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit, type RateLimitVerdict } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

function failSignUp(message: string): never {
  redirect(`/sign-up?error=${encodeURIComponent(message)}`);
}

// Every sign-up sends a confirmation email, so this is the one place the
// limiter fails closed (see src/lib/rateLimit): with the store down, pausing
// new sign-ups is cheaper than an unbounded stream of outbound mail.
const rejectionFor = (verdict: RateLimitVerdict): string | null => {
  if (verdict === "limited") {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (verdict === "unavailable") {
    return "Sign-up is temporarily unavailable. Please try again shortly.";
  }
  return null;
};

export const signUp = async (formData: FormData) => {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    failSignUp(parsed.error.issues[0]?.message ?? "Invalid form submission");
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

  const origin = (await headers()).get("origin");
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

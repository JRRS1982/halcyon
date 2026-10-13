"use server";

import { redirect } from "next/navigation";
import { startActivityClock } from "@/lib/auth/activityClock";
import type { AuthNoticeCode } from "@/lib/auth/authNotices";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { safeNext } from "@/lib/auth/safeNext";
import { signInSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// One message for every way a sign-in can fail at the provider. Supabase's own
// messages differ — "Invalid login credentials" for an unknown address, "Email
// not confirmed" for a registered one — so echoing them would let anyone with
// a list of addresses learn which ones have an account here. The provider's
// message goes to the server log instead, where it is still useful.
// A code, never a message: see lib/auth/authNotices.ts. The page looks it up
// and renders nothing for anything it did not produce.
function failSignIn(code: AuthNoticeCode): never {
  redirect(`/sign-in?error=${code}`);
}

// Which field the user got wrong is worth saying; the schema's own wording is
// not carried in the URL to say it.
const issueCode = (
  issue: { path: PropertyKey[] } | undefined,
): AuthNoticeCode =>
  issue?.path[0] === "email" ? "invalid-email" : "password-required";

export const signIn = async (formData: FormData) => {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeNext(formData.get("next"), POST_AUTH_LANDING);

  if (!parsed.success) {
    failSignIn(issueCode(parsed.error.issues[0]));
  }

  // Two buckets: the client's IP bounds one attacker, the account bounds a
  // pool of IPs all guessing at the same address.
  const ipVerdict = await checkRateLimit("sign-in", await clientIp());
  const accountVerdict = await checkRateLimit(
    "sign-in-account",
    parsed.data.email,
  );
  if (ipVerdict !== "allowed" || accountVerdict !== "allowed") {
    failSignIn("too-many-attempts");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Message and status only: a wrong password is routine, not an exception,
  // so it does not earn a stack trace in the log.
  if (error) {
    log.warn("Sign-in rejected by provider", {
      status: error.status,
      message: error.message,
    });
    failSignIn("sign-in-failed");
  }

  await startActivityClock();
  redirect(next);
};

// Dev-only convenience: one-click sign-in as the seeded demo user. Refuses in
// production (defence-in-depth — the button is also stripped from the prod
// bundle via `demoLoginEnabled`). Never reaches production, so the provider's
// message is shown as-is: it is the developer's own debugging aid.
export const signInAsDemo = async (formData: FormData) => {
  if (process.env.NODE_ENV === "production") {
    redirect("/sign-in");
  }
  const next = safeNext(formData.get("next"), POST_AUTH_LANDING);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    // Dev-only path, but the provider's message still does not travel through
    // the URL — it goes where the developer actually reads it.
    log.warn("Demo sign-in rejected by provider", { message: error.message });
    failSignIn("sign-in-failed");
  }

  await startActivityClock();
  redirect(next);
};

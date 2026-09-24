"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { safeNext } from "@/lib/auth/safeNext";
import { signInSchema } from "@/lib/auth/schemas";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  nextActivity,
  serializeActivity,
} from "@/lib/auth/sessionTimeout";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// One message for every way a sign-in can fail at the provider. Supabase's own
// messages differ — "Invalid login credentials" for an unknown address, "Email
// not confirmed" for a registered one — so echoing them would let anyone with
// a list of addresses learn which ones have an account here. The provider's
// message goes to the server log instead, where it is still useful.
const SIGN_IN_FAILED_MESSAGE = "Email or password is incorrect.";

const TOO_MANY_ATTEMPTS_MESSAGE =
  "Too many attempts. Please wait a minute and try again.";

function failSignIn(message: string): never {
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);
}

// Starts the session-timeout clock at the moment the session is created.
//
// The proxy stamps this cookie on every request it sees, but it never sees the
// one that matters most: `redirect()` from a server action produces an RSC
// navigation, not a document request, so a freshly signed-in user would carry
// no activity stamp until they happened to trigger a full page load. Until
// then `parseActivity` reads null, which is treated as "no history" — so the
// absolute limit would keep restarting instead of counting down.
const startActivityClock = async () => {
  const jar = await cookies();
  jar.set(
    ACTIVITY_COOKIE,
    serializeActivity(nextActivity(null, Date.now())),
    activityCookieOptions,
  );
};

export const signIn = async (formData: FormData) => {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeNext(formData.get("next"), POST_AUTH_LANDING);

  if (!parsed.success) {
    failSignIn(parsed.error.issues[0]?.message ?? "Invalid form submission");
  }

  // Two buckets: the client's IP bounds one attacker, the account bounds a
  // pool of IPs all guessing at the same address.
  const ipVerdict = await checkRateLimit("sign-in", await clientIp());
  const accountVerdict = await checkRateLimit(
    "sign-in-account",
    parsed.data.email,
  );
  if (ipVerdict !== "allowed" || accountVerdict !== "allowed") {
    failSignIn(TOO_MANY_ATTEMPTS_MESSAGE);
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
    failSignIn(SIGN_IN_FAILED_MESSAGE);
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
    failSignIn(error.message);
  }

  await startActivityClock();
  redirect(next);
};

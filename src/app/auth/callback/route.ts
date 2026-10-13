import { NextResponse } from "next/server";
import { startActivityClock } from "@/lib/auth/activityClock";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { isRecoveryExchange } from "@/lib/auth/redirectType";
import { safeNext } from "@/lib/auth/safeNext";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// Called by Supabase Auth after email confirmation, magic-link click, or OAuth
// provider redirect. Exchanges the one-time `code` query param for a session
// cookie, then forwards the user to wherever they were heading.
export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), POST_AUTH_LANDING);

  const refuse = (message: string) =>
    NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(message)}`,
    );

  // Supabase redirects here with `error`/`error_description` and no code when
  // the user declines consent at the provider, or follows a link that has
  // expired or already been used. Those arrive on the same path as a missing
  // code but are not the same thing, and reporting them as "Missing auth code"
  // reads like a bug in this app rather than a choice the user just made.
  const providerError = searchParams.get("error");
  if (providerError) {
    log.error("Auth provider returned an error", { err: providerError });
    return refuse(searchParams.get("error_description") ?? providerError);
  }

  if (!code) return refuse("Missing auth code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    log.error("Auth code exchange failed", { err: error });
    return refuse(error.message);
  }

  // This app has no password-reset screen. Without this check a recovery code
  // would mint an ordinary session and land the user on the dashboard, signed
  // in and never asked for a new password — and a recovery link is proof of
  // email control meant to lead to setting one, not a general-purpose login.
  // Nothing here calls resetPasswordForEmail today, so this is the guard that
  // makes adding password reset a deliberate act rather than a silent one.
  //
  // The exchange has already written the session cookie by the time it
  // returns, so refusing means ending that session: a redirect on its own
  // would leave the browser holding a working one, a navigation away from
  // everything it was supposed to refuse.
  if (isRecoveryExchange(data)) {
    log.error("Refused a recovery code at the auth callback", {
      err: "no password-reset flow in this app",
    });
    await supabase.auth.signOut();
    return refuse("That link can't be used to sign in");
  }

  // Sessions born here (OAuth, email confirmation, magic link) carry no
  // activity cookie, and the proxy reads its absence as expired — so without
  // this the user lands straight back on /sign-in.
  await startActivityClock();

  return NextResponse.redirect(`${origin}${next}`);
};

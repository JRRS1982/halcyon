import { NextResponse } from "next/server";
import { startActivityClock } from "@/lib/auth/activityClock";
import type { AuthNoticeCode } from "@/lib/auth/authNotices";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { isRecoveryExchange } from "@/lib/auth/redirectType";
import { safeNext } from "@/lib/auth/safeNext";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// Called by Supabase Auth after email confirmation, magic-link click, or OAuth
// provider redirect. Exchanges the one-time `code` query param for a session
// cookie, then forwards the user to wherever they were heading.
export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), POST_AUTH_LANDING);

  // A code, never a message: see lib/auth/authNotices.ts. This route is the
  // reason that matters most — the provider's own error_description arrives
  // here as attacker-influenced text, and forwarding it put that text in the
  // one parameter the sign-in page used to render verbatim.
  const refuse = (code: AuthNoticeCode) =>
    NextResponse.redirect(`${origin}/sign-in?error=${code}`);

  // Supabase redirects here with `error`/`error_description` and no code when
  // the user declines consent at the provider, or follows a link that has
  // expired or already been used. Those arrive on the same path as a missing
  // code but are not the same thing, and reporting them as "Missing auth code"
  // reads like a bug in this app rather than a choice the user just made.
  const providerError = searchParams.get("error");
  if (providerError) {
    // The description is logged, not shown. It is the provider's text about
    // the user's own choice, and the page has its own words for that.
    log.error("Auth provider returned an error", {
      err: providerError,
      description: searchParams.get("error_description") ?? undefined,
    });
    return refuse(
      providerError === "access_denied" ? "provider-declined" : "link-expired",
    );
  }

  if (!code) return refuse("missing-code");

  // Per client IP, before the exchange. This route is unauthenticated and every
  // request carrying a code spends one call on Supabase's token endpoint, so a
  // loop here burns the project's auth budget rather than this app's — and real
  // users meet a locked sign-in while it runs. Fails open by policy, with no
  // provider throttle behind it — see the note on the bucket in lib/rateLimit
  // for which cost that trade accepts and which it avoids.
  if ((await checkRateLimit("auth-callback", await clientIp())) !== "allowed") {
    return refuse("too-many-attempts");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    log.error("Auth code exchange failed", { err: error });
    return refuse("link-expired");
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
    return refuse("link-unusable");
  }

  // Sessions born here (OAuth, email confirmation, magic link) carry no
  // activity cookie, and the proxy reads its absence as expired — so without
  // this the user lands straight back on /sign-in.
  await startActivityClock();

  return NextResponse.redirect(`${origin}${next}`);
};

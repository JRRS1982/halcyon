import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  evaluateSession,
  nextActivity,
  parseActivity,
  SESSION_TIMEOUT,
  serializeActivity,
} from "@/lib/auth/sessionTimeout";
import { env } from "@/lib/env";

// Called from `src/proxy.ts` on every request. Refreshes the Supabase
// session cookies so that server components see a current user, enforces the
// idle/absolute session limits, and (optionally) redirects unauthenticated
// requests away from protected paths.
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not run any other code between createServerClient and
  // getUser. The call refreshes the session cookies in `supabaseResponse`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protection: any path starting with one of these requires a session.
  // Unauthenticated visits get redirected to /sign-in with `?next=...` so the
  // user can be sent back where they were heading after they log in.
  const protectedPaths = [
    "/dashboard",
    "/budget",
    "/balance",
    "/settings",
    "/plan",
    "/transactions",
  ];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (!user) return supabaseResponse;

  const now = Date.now();
  const activity = parseActivity(request.cookies.get(ACTIVITY_COOKIE)?.value);
  const session = evaluateSession(activity, now, SESSION_TIMEOUT);

  if (session.status === "expired") {
    return expireSession(request, supabase, session.reason);
  }

  supabaseResponse.cookies.set(
    ACTIVITY_COOKIE,
    serializeActivity(nextActivity(activity, now)),
    activityCookieOptions,
  );

  // The mirror image of the route guard above: the marketing page is for
  // prospects, so a signed-in visitor goes straight to the app. This lived in
  // the "/" server component, which meant a second getUser() round-trip on the
  // page where first-load speed matters most. We already know who they are.
  //
  // Deliberately after the expiry check — a timed-out session must be expired,
  // not quietly forwarded — and the response carries `supabaseResponse`'s
  // cookies so the refreshed auth tokens and the activity stamp survive the
  // redirect instead of being dropped with the discarded response.
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = POST_AUTH_LANDING;
    const redirect = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return supabaseResponse;
};

// Ends a timed-out session: revokes the refresh token with Supabase, clears
// every auth cookie on the redirect, and sends the user to /sign-in with a
// reason the page can explain.
const expireSession = async (
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>,
  reason: "idle" | "absolute",
) => {
  // Captured before signOut, which writes through the cookie adapter above and
  // so edits `request.cookies` as it goes. Reading the names first keeps this
  // independent of how the library chooses to clear them.
  const authCookieNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => name.startsWith("sb-"));

  // Best-effort: if the call fails the cookies below still end the session in
  // this browser, and the access token expires on its own within the hour.
  await supabase.auth.signOut().catch(() => undefined);

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("timeout", reason);
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("next", request.nextUrl.pathname);
  }

  const response = NextResponse.redirect(url);
  response.cookies.delete(ACTIVITY_COOKIE);
  for (const name of authCookieNames) {
    response.cookies.delete(name);
  }

  return response;
};

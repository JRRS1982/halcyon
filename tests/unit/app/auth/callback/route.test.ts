/**
 * @jest-environment node
 */
const exchangeCodeForSession = jest.fn(async () => ({
  data: { redirectType: null },
  error: null,
}));
const signOut = jest.fn(async () => ({ error: null }));
const cookieSet = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, signOut } }),
}));
jest.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));
jest.mock("@/lib/log", () => ({ log: { error: jest.fn() } }));
jest.mock("@/lib/http/clientIp", () => ({ clientIp: async () => "1.2.3.4" }));
// The real limiter, over an in-memory Redis: see fakeRateLimitStore.
jest.mock("@/lib/rateLimit/redis", () =>
  jest.requireActual("@test/support/fakeRateLimitStore"),
);

import { exhaust, resetStore } from "@test/support/fakeRateLimitStore";
import { GET } from "@/app/auth/callback/route";
import { ACTIVITY_COOKIE, parseActivity } from "@/lib/auth/sessionTimeout";

const callback = (url: string) => GET(new Request(url));

describe("auth callback", () => {
  beforeEach(() => {
    cookieSet.mockClear();
    signOut.mockClear();
    resetStore();
  });

  // Unauthenticated, and every request with a code spends one call on
  // Supabase's token endpoint — so a loop here costs the project's auth budget
  // and locks real users out of sign-in while it runs.
  it("refuses once the per-IP limit is spent, before any exchange", async () => {
    exhaust("auth-callback");

    const response = await callback(
      "https://balanced.money/auth/callback?code=abc",
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/sign-in?error=too-many-attempts",
    );
  });

  // The proxy treats an authenticated request with no readable activity cookie
  // as expired. The password form seeds that clock itself, but every session
  // born here — Google sign-in, email confirmation, magic link — arrived
  // without one, which after that guard landed the user straight back on
  // /sign-in. Seeding here is what keeps OAuth usable.
  it("starts the activity clock for a session it created", async () => {
    await callback("https://balanced.money/auth/callback?code=abc");

    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVITY_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    const [, value] = cookieSet.mock.calls[0] as [string, string, unknown];
    expect(parseActivity(value)).not.toBeNull();
  });

  it("does not start a clock when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "bad code" },
    } as never);

    await callback("https://balanced.money/auth/callback?code=bad");

    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("does not start a clock when there is no code at all", async () => {
    await callback("https://balanced.money/auth/callback");

    expect(cookieSet).not.toHaveBeenCalled();
  });

  // redirectType comes from the PKCE verifier cookie written when the flow
  // started, not from a query param, so it is a signal about this browser's
  // own flow rather than something a link can assert. It is "recovery" only
  // when resetPasswordForEmail opened the flow.
  //
  // Reset links go to /reset-password, never here; a recovery code reaching
  // this route would mint a full session and drop the user on the dashboard —
  // signed in, never asked for a new password. A recovery link is proof of
  // email control leading to a password set, not a general-purpose login.
  it("refuses a recovery code rather than signing the user in", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { redirectType: "recovery" },
      error: null,
    } as never);

    const response = await callback(
      "https://balanced.money/auth/callback?code=abc",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/sign-in?error=link-unusable",
    );
  });

  // exchangeCodeForSession writes the session cookie before it returns, so a
  // refusal that only redirects leaves the browser holding a working session
  // and the user one navigation away from the dashboard.
  it("ends the session it refuses rather than only redirecting", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { redirectType: "recovery" },
      error: null,
    } as never);

    await callback("https://balanced.money/auth/callback?code=abc");

    expect(signOut).toHaveBeenCalled();
  });

  // Supabase redirects here with `error`/`error_description` and no code when
  // the user declines consent at the provider or follows an expired link.
  // Reported as "Missing auth code", that reads like a bug in the app.
  it("surfaces the provider's reason instead of a missing-code message", async () => {
    const response = await callback(
      "https://balanced.money/auth/callback?error=access_denied&error_description=User%20declined",
    );

    const location = response.headers.get("location") ?? "";
    // A code the page can look up, not the provider's text. The description is
    // logged instead — it is attacker-influenced, and `?error=` is rendered.
    expect(location).toContain("/sign-in?error=provider-declined");
    expect(location).not.toContain("User");
    expect(location).not.toContain("missing-code");
  });
});

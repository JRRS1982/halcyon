/**
 * @jest-environment node
 *
 * NextRequest is built on the Web Fetch API, which jsdom does not provide;
 * the node environment has Request/Response as globals.
 */

// The proxy is the app's route-protection boundary (docs/features/auth.md).
// It already resolves the session on every request, so both redirects live
// here rather than in page components — a page-level check would repeat the
// auth round-trip the proxy has just made.

const getUser = jest.fn();
const signOut = jest.fn(async () => undefined);
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser, signOut } }),
}));
jest.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  },
}));

import { NextRequest } from "next/server";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { ACTIVITY_COOKIE, serializeActivity } from "@/lib/auth/sessionTimeout";
import { updateSession } from "@/lib/supabase/middleware";

// Every request carries a live activity stamp. The proxy expires a signed-in
// request that arrives without one, so these redirect assertions would
// otherwise all be exercising the expiry path instead of the routing it is
// meant to check. Ignored outright on the signed-out cases.
const requestFor = (path: string) => {
  const request = new NextRequest(new URL(`http://localhost:3000${path}`));
  const now = Date.now();
  request.cookies.set(
    ACTIVITY_COOKIE,
    serializeActivity({ startedAt: now, lastSeenAt: now }),
  );
  return request;
};

const signedIn = () =>
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email_confirmed_at: "2026-01-01T00:00:00Z" } },
  });

// Supabase returns a live session for an unconfirmed address when the project's
// "Confirm email" toggle is off. The app refuses it in code rather than relying
// on that dashboard setting staying as it is.
const signedInUnconfirmed = () =>
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email_confirmed_at: null } },
  });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });

describe("proxy redirects", () => {
  beforeEach(() => getUser.mockReset());

  // Asserted against the constant, not a literal: "/" and the sign-in form must
  // agree on where the app starts, so a change to one should never leave the
  // other behind.
  test("sends a signed-in visitor from / into the app", async () => {
    signedIn();
    const res = await updateSession(requestFor("/"));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe(
      POST_AUTH_LANDING,
    );
  });

  test("turns an unconfirmed account away from a protected route", async () => {
    signedInUnconfirmed();
    const res = await updateSession(requestFor("/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  test("leaves the marketing page alone for signed-out visitors", async () => {
    signedOut();
    const res = await updateSession(requestFor("/"));

    expect(res.headers.get("location")).toBeNull();
  });

  test("still fences protected routes, remembering where they were headed", async () => {
    signedOut();
    const res = await updateSession(requestFor("/budget"));

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/budget");
  });

  test("lets a signed-in visitor through to a protected route", async () => {
    signedIn();
    const res = await updateSession(requestFor("/budget"));

    expect(res.headers.get("location")).toBeNull();
  });

  // The redirect is scoped to exactly "/" — it must not catch other public
  // pages a signed-in user may legitimately want to read.
  test.each(["/privacy", "/terms"])(
    "does not bounce a signed-in visitor away from %s",
    async (path) => {
      signedIn();
      const res = await updateSession(requestFor(path));

      expect(res.headers.get("location")).toBeNull();
    },
  );
});

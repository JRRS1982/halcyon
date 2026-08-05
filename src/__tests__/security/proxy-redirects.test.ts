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
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));
jest.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  },
}));

import { updateSession } from "@/lib/supabase/middleware";
import { NextRequest } from "next/server";

const requestFor = (path: string) =>
  new NextRequest(new URL(`http://localhost:3000${path}`));

const signedIn = () =>
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });

describe("proxy redirects", () => {
  beforeEach(() => getUser.mockReset());

  test("sends a signed-in visitor from / to their dashboard", async () => {
    signedIn();
    const res = await updateSession(requestFor("/"));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe(
      "/dashboard",
    );
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

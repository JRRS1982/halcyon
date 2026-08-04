/**
 * @jest-environment node
 */
import {
  ACTIVITY_COOKIE,
  SESSION_TIMEOUT,
  parseActivity,
  serializeActivity,
} from "@/lib/auth/sessionTimeout";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

jest.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  },
}));

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: {
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }[],
  ) => void;
};

const signOut = jest.fn().mockResolvedValue({ error: null });
let currentUser: { id: string } | null = { id: "user-1" };

jest.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: CookieAdapter },
  ) => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
      // The real client clears the auth cookies by writing back through the
      // adapter, which edits the incoming request as a side effect. Modelling
      // that here keeps the "clears the auth cookies" assertions honest.
      signOut: async () => {
        const cleared = options.cookies
          .getAll()
          .filter(({ name }) => name.startsWith("sb-"))
          .map(({ name }) => ({ name, value: "", options: { maxAge: 0 } }));
        options.cookies.setAll(cleared);
        return signOut();
      },
    },
  }),
}));

const MINUTE = 60 * 1000;

const buildRequest = (
  path: string,
  cookies: Record<string, string> = {},
): NextRequest => {
  const request = new NextRequest(new URL(`http://localhost${path}`));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
};

const activityCookie = (startedAgoMs: number, lastSeenAgoMs: number): string =>
  serializeActivity({
    startedAt: Date.now() - startedAgoMs,
    lastSeenAt: Date.now() - lastSeenAgoMs,
  });

// Derived from the live config rather than hard-coded hours, so that retuning
// the windows cannot quietly turn an "idle" fixture into an "absolute" one.
// A session last seen just beyond the idle window, started at the same moment —
// old enough to be idle, young enough that the absolute cap has not bitten.
const idleExpired = () =>
  activityCookie(
    SESSION_TIMEOUT.idleMs + MINUTE,
    SESSION_TIMEOUT.idleMs + MINUTE,
  );

// Busy right up to now, but started before the absolute cap allows.
const absoluteExpired = () =>
  activityCookie(SESSION_TIMEOUT.absoluteMs + MINUTE, 0);

beforeEach(() => {
  currentUser = { id: "user-1" };
  signOut.mockClear();
});

describe("updateSession — activity tracking", () => {
  it("starts the activity clock when a signed-in request has no cookie", async () => {
    const response = await updateSession(buildRequest("/dashboard"));

    const activity = parseActivity(
      response.cookies.get(ACTIVITY_COOKIE)?.value,
    );
    expect(activity).not.toBeNull();
    expect(activity?.startedAt).toBeCloseTo(activity?.lastSeenAt ?? 0, -2);
  });

  it("advances lastSeenAt but preserves startedAt on an active session", async () => {
    const startedAt = Date.now() - (SESSION_TIMEOUT.absoluteMs - MINUTE);
    const request = buildRequest("/dashboard", {
      [ACTIVITY_COOKIE]: serializeActivity({
        startedAt,
        lastSeenAt: Date.now() - MINUTE,
      }),
    });

    const response = await updateSession(request);

    const activity = parseActivity(
      response.cookies.get(ACTIVITY_COOKIE)?.value,
    );
    expect(activity?.startedAt).toBe(startedAt);
    expect(activity?.lastSeenAt).toBeGreaterThan(Date.now() - 1000);
  });

  it("outlives both timeout windows so eviction cannot resurrect a session", async () => {
    const response = await updateSession(buildRequest("/dashboard"));

    const maxAge = response.cookies.get(ACTIVITY_COOKIE)?.maxAge ?? 0;
    expect(maxAge * 1000).toBeGreaterThanOrEqual(SESSION_TIMEOUT.absoluteMs);
    expect(maxAge * 1000).toBeGreaterThan(SESSION_TIMEOUT.idleMs);
  });

  it("marks the cookie httpOnly and lax", async () => {
    const response = await updateSession(buildRequest("/dashboard"));

    const cookie = response.cookies.get(ACTIVITY_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("does not track activity for signed-out visitors", async () => {
    currentUser = null;

    const response = await updateSession(buildRequest("/"));

    expect(response.cookies.get(ACTIVITY_COOKIE)).toBeUndefined();
  });
});

describe("updateSession — expiry", () => {
  it("signs out and redirects when the idle window has elapsed", async () => {
    const request = buildRequest("/budget", {
      [ACTIVITY_COOKIE]: idleExpired(),
    });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("timeout")).toBe("idle");
    expect(location.searchParams.get("next")).toBe("/budget");
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out and redirects when the absolute cap has elapsed", async () => {
    const request = buildRequest("/dashboard", {
      [ACTIVITY_COOKIE]: absoluteExpired(),
    });

    const response = await updateSession(request);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("timeout")).toBe("absolute");
  });

  it("clears the supabase auth cookies on the redirect", async () => {
    const request = buildRequest("/dashboard", {
      [ACTIVITY_COOKIE]: idleExpired(),
      "sb-localhost-auth-token": "stale-token",
    });

    const response = await updateSession(request);

    expect(response.cookies.get("sb-localhost-auth-token")?.value).toBe("");
    expect(response.cookies.get(ACTIVITY_COOKIE)?.value).toBe("");
  });

  it("still redirects when revoking the refresh token fails", async () => {
    signOut.mockRejectedValueOnce(new Error("supabase unreachable"));
    const request = buildRequest("/dashboard", {
      [ACTIVITY_COOKIE]: idleExpired(),
    });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.cookies.get(ACTIVITY_COOKIE)?.value).toBe("");
  });

  it("drops the next param when timing out on the home page", async () => {
    const request = buildRequest("/", {
      [ACTIVITY_COOKIE]: idleExpired(),
    });

    const response = await updateSession(request);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("next")).toBeNull();
  });
});

describe("updateSession — existing route protection", () => {
  it("redirects signed-out visitors away from protected paths", async () => {
    currentUser = null;

    const response = await updateSession(buildRequest("/settings"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/settings");
    expect(location.searchParams.get("timeout")).toBeNull();
  });

  it("lets signed-out visitors through to public paths", async () => {
    currentUser = null;

    const response = await updateSession(buildRequest("/privacy"));

    expect(response.status).toBe(200);
  });
});

/**
 * @jest-environment node
 */
const mockSignUp = jest.fn(
  async (
    _args: unknown,
  ): Promise<{ error: { message: string; status?: number } | null }> => ({
    error: null,
  }),
);

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signUp: (args: unknown) => mockSignUp(args) },
  }),
}));

// The server-owned origin the confirmation link is built from. Stubbed at the
// config boundary: CI has no .env, and the real module validates on import.
jest.mock("@/lib/env", () => ({
  emailEnv: { SITE_URL: "https://balanced.money" },
}));
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
}));

// The real limiter, over an in-memory Redis: see fakeRateLimitStore.
jest.mock("@/lib/rateLimit/redis", () =>
  jest.requireActual("@test/support/fakeRateLimitStore"),
);

jest.mock("@/lib/log", () => ({ log: { warn: jest.fn(), error: jest.fn() } }));

import {
  exhaust,
  resetStore,
  takeStoreDown,
} from "@test/support/fakeRateLimitStore";
import { signUp } from "@/app/(app)/sign-up/actions";

const PASSWORD = "a-fresh-long-password";

// HIBP's range endpoint, mocked at the HTTP boundary so the real breach check
// runs. An empty body is "no match".
const hibpAnswers = (body: string) =>
  jest.fn(
    async (_url: URL | RequestInfo, _init?: RequestInit) =>
      ({ ok: true, text: async () => body }) as unknown as Response,
  );

async function sha1Upper(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function landsOn(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw err;
  }
  throw new Error("expected a redirect");
}

const submit = (email = "someone@example.com", password = PASSWORD) => {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return landsOn(signUp(form));
};

describe("signUp", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockSignUp.mockResolvedValue({ error: null });
    resetStore();
    global.fetch = hibpAnswers("");
  });

  afterEach(() => {
    // @ts-expect-error — restoring the global between cases.
    global.fetch = undefined;
  });

  it("sends a confirmation link back to this site's callback", async () => {
    await expect(submit()).resolves.toBe("/sign-up?success=1");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: "https://balanced.money/auth/callback" },
      }),
    );
  });

  // "User already registered" must not reach the page, or sign-up becomes a
  // way to test which addresses have accounts.
  it("answers the same for an address that already has an account", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered", status: 400 },
    });

    await expect(submit()).resolves.toBe("/sign-up?success=1");
  });

  it("refuses a password found in a breach", async () => {
    const hash = await sha1Upper(PASSWORD);
    global.fetch = hibpAnswers(`${hash.slice(5)}:42`);

    await expect(submit()).resolves.toBe("/sign-up?error=password-breached");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("refuses a password under twelve characters", async () => {
    await expect(submit("someone@example.com", "short")).resolves.toBe(
      "/sign-up?error=password-too-short",
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("bounds how many confirmation emails one inbox can be sent", async () => {
    exhaust("sign-up-address");

    await expect(submit()).resolves.toBe("/sign-up?error=too-many-attempts");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // Every sign-up sends an email, so a limiter outage pauses sign-ups rather
  // than letting them through unbounded.
  it("pauses sign-up while the limiter's store is down", async () => {
    takeStoreDown();

    await expect(submit()).resolves.toBe("/sign-up?error=signup-unavailable");
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});

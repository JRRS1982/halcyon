/**
 * @jest-environment node
 */
type AuthError = { message: string; status?: number } | null;

const mockSignInWithPassword = jest.fn(
  async (_args: unknown): Promise<{ error: AuthError }> => ({ error: null }),
);

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (args: unknown) => mockSignInWithPassword(args),
    },
  }),
}));

const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
  cookies: async () => ({ set: mockCookieSet }),
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
import { signIn } from "@/app/(app)/sign-in/actions";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";

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

const submit = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return landsOn(signIn(form));
};

const valid = { email: "someone@example.com", password: "a-long-password" };

describe("signIn", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockCookieSet.mockClear();
    resetStore();
  });

  it("signs in and lands on the app", async () => {
    await expect(submit(valid)).resolves.toBe(POST_AUTH_LANDING);
  });

  it("returns the user to where they were heading", async () => {
    await expect(submit({ ...valid, next: "/budget" })).resolves.toBe(
      "/budget",
    );
  });

  // `next` comes from the URL; following it off-site would make the sign-in
  // page an open redirect into a phishing copy of itself.
  it("never follows next to another site", async () => {
    await expect(
      submit({ ...valid, next: "https://evil.example/login" }),
    ).resolves.toBe(POST_AUTH_LANDING);
  });

  // An unknown address and a wrong password must look the same, or the form
  // tells anyone which addresses have accounts here.
  it("answers every provider refusal with the same message", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials", status: 400 },
    });
    const wrongPassword = await submit(valid);
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Email not confirmed", status: 400 },
    });
    const unconfirmed = await submit(valid);

    expect(wrongPassword).toBe("/sign-in?error=sign-in-failed");
    expect(unconfirmed).toBe(wrongPassword);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("stops guessing at one account before asking the provider", async () => {
    exhaust("sign-in-account");

    await expect(submit(valid)).resolves.toBe(
      "/sign-in?error=too-many-attempts",
    );
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  // Supabase's own throttle still stands behind this one, so a cache outage
  // must not become a sign-in outage.
  it("still signs in while the limiter's store is down", async () => {
    takeStoreDown();

    await expect(submit(valid)).resolves.toBe(POST_AUTH_LANDING);
  });

  it("asks for a password when none was given", async () => {
    await expect(submit({ email: valid.email, password: "" })).resolves.toBe(
      "/sign-in?error=password-required",
    );
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

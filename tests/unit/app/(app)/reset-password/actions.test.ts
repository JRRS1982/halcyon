/**
 * @jest-environment node
 */
type AuthError = { message: string; code?: string } | null;

const mockVerifyOtp = jest.fn(
  async (
    _args: unknown,
  ): Promise<{
    data: { user: { id: string; identities: { provider: string }[] } | null };
    error: AuthError;
  }> => ({
    data: { user: { id: "user-1", identities: mockIdentities } },
    error: null,
  }),
);
const mockUpdateUser = jest.fn(
  async (_args: unknown): Promise<{ error: AuthError }> => ({ error: null }),
);
const mockSignOut = jest.fn(
  async (_args: unknown): Promise<{ error: AuthError }> => ({ error: null }),
);
// Mutable so a case can present a Google-only account.
let mockIdentities: { provider: string }[] = [{ provider: "email" }];

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: (args: unknown) => mockVerifyOtp(args),
      updateUser: (args: unknown) => mockUpdateUser(args),
      signOut: (args: unknown) => mockSignOut(args),
    },
  }),
}));

const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
  cookies: async () => ({ set: mockCookieSet }),
}));

const mockCheckRateLimit = jest.fn(
  async (_action: string, _subject: string | null): Promise<string> =>
    "allowed",
);
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (action: string, subject: string | null) =>
    mockCheckRateLimit(action, subject),
}));

jest.mock("@/lib/log", () => ({ log: { warn: jest.fn(), error: jest.fn() } }));

import { resetPassword } from "@/app/(app)/reset-password/actions";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { ACTIVITY_COOKIE } from "@/lib/auth/sessionTimeout";

const TOKEN = "pkce_0123456789abcdef";
const NEW = "a-fresh-long-password";

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

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

// Every outcome of this action is a redirect. Next's redirect() throws an
// error whose digest carries the target; reading it is reading where the user
// lands.
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

const submit = (fields: Record<string, string> = {}) =>
  landsOn(resetPassword(form({ tokenHash: TOKEN, password: NEW, ...fields })));

describe("resetPassword", () => {
  beforeEach(() => {
    mockIdentities = [{ provider: "email" }];
    mockVerifyOtp.mockClear();
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockClear();
    mockCookieSet.mockClear();
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue("allowed");
    global.fetch = hibpAnswers("");
  });

  afterEach(() => {
    // @ts-expect-error — restoring the global between cases.
    global.fetch = undefined;
  });

  it("sets the new password and lands the user signed in on the app", async () => {
    await expect(submit()).resolves.toBe(POST_AUTH_LANDING);

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: NEW });
    // Without the activity cookie the proxy reads the new session as expired.
    expect(mockCookieSet).toHaveBeenCalledWith(
      ACTIVITY_COOKIE,
      expect.any(String),
      expect.anything(),
    );
  });

  // A reset usually means someone else may know the old password.
  it("signs out every other session, keeping this one", async () => {
    await submit();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  // Mail scanners open links; the token must only be spent on a deliberate
  // submit. These refusals all happen before it, so the link still works.
  describe("refusals that keep the link usable", () => {
    it("refuses a password under twelve characters", async () => {
      await expect(submit({ password: "short" })).resolves.toBe(
        `/reset-password?token_hash=${TOKEN}&error=password-too-short`,
      );
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("refuses a password found in a breach", async () => {
      const hash = await sha1Upper(NEW);
      global.fetch = hibpAnswers(`${hash.slice(5)}:42`);

      await expect(submit()).resolves.toBe(
        `/reset-password?token_hash=${TOKEN}&error=password-breached`,
      );
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("refuses once the per-IP limit is spent", async () => {
      mockCheckRateLimit.mockResolvedValue("limited");

      await expect(submit()).resolves.toBe(
        `/reset-password?token_hash=${TOKEN}&error=too-many-attempts`,
      );
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });
  });

  it("sends an expired or used link back to request a new one", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Token has expired or is invalid" },
    });

    await expect(submit()).resolves.toBe(
      "/forgot-password?error=reset-link-invalid",
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("sends a submit with no link back to request one", async () => {
    await expect(landsOn(resetPassword(form({ password: NEW })))).resolves.toBe(
      "/forgot-password?error=reset-link-invalid",
    );
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  // A Google-only account has no password; a reset link must not hand it one,
  // and verifying the link signed the browser in, so that session must end.
  it("refuses a Google-only account without giving it a password", async () => {
    mockIdentities = [{ provider: "google" }];

    await expect(submit()).resolves.toBe("/sign-in?error=reset-google-account");
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("tells the user when the new password is the one they already have", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "same", code: "same_password" },
    });

    await expect(submit()).resolves.toBe("/sign-in?error=reset-same-password");
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("ends the session when the provider refuses the new password", async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: { message: "weak" } });

    await expect(submit()).resolves.toBe("/sign-in?error=reset-failed");
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

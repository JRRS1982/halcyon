/**
 * @jest-environment node
 */
const mockSignInWithPassword = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const mockUpdateUser = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const mockSignOut = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
// Mutable so a case can present a Google-only account.
let mockIdentities: { provider: string }[] = [{ provider: "email" }];
let mockEmail: string | null = "test@example.com";

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            email: mockEmail,
            identities: mockIdentities,
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
      signInWithPassword: (args: unknown) => mockSignInWithPassword(args),
      updateUser: (args: unknown) => mockUpdateUser(args),
      signOut: (args: unknown) => mockSignOut(args),
    },
  }),
}));

// verifyUser reads the client IP for its per-IP bucket, and `headers()` needs
// a request scope Jest has none of.
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
}));

const mockCheckRateLimit = jest.fn(
  async (_action: string, _subject: string | null): Promise<string> =>
    "allowed",
);
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (action: string, subject: string | null) =>
    mockCheckRateLimit(action, subject),
}));

const mockLogWarn = jest.fn();
const mockLogError = jest.fn();
jest.mock("@/lib/log", () => ({
  log: {
    warn: (...a: unknown[]) => mockLogWarn(...a),
    error: (...a: unknown[]) => mockLogError(...a),
  },
}));

import { changePassword } from "@/app/(app)/settings/credentialActions";

const CURRENT = "the-old-password";
const NEW = "a-fresh-long-password";

// HIBP's range endpoint, answering "this suffix is not in the corpus" unless a
// case says otherwise. Mocked at the HTTP boundary rather than by replacing
// checkPasswordBreach, so the real k-anonymity code runs.
const hibpAnswers = (body: string, ok = true) =>
  jest.fn(
    async (_url: URL | RequestInfo, _init?: RequestInit) =>
      ({ ok, text: async () => body }) as unknown as Response,
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

// Every refusal is RETURNED, not thrown. A thrown message does not survive a
// production build — Next sends only a digest — so a panel reading err.message
// would show one generic line for every cause. These assertions are on the
// returned reason for that reason.
describe("changePassword", () => {
  beforeEach(() => {
    mockIdentities = [{ provider: "email" }];
    mockEmail = "test@example.com";
    mockSignInWithPassword.mockClear();
    mockUpdateUser.mockClear();
    mockSignOut.mockClear();
    // mockReset, not mockClear: a case that drives the limiter to "limited"
    // sets an implementation, and clearing only the call log would leave it
    // limited for every case after it.
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue("allowed");
    mockLogWarn.mockClear();
    mockLogError.mockClear();
    global.fetch = hibpAnswers("0000000000000000000000000000000000A:3");
  });

  afterEach(() => {
    // @ts-expect-error — restoring the global between cases.
    global.fetch = undefined;
  });

  it("sets the new password once the current one checks out", async () => {
    await changePassword({ currentPassword: CURRENT, newPassword: NEW });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: CURRENT,
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: NEW });
  });

  // The reason to change a password is usually that someone else may have
  // access. Leaving their session alive makes the change cosmetic.
  it("revokes every other session, keeping this one", async () => {
    await changePassword({ currentPassword: CURRENT, newPassword: NEW });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  // An unlocked signed-in browser must not be able to lock the owner out of
  // their own account.
  it("refuses a wrong current password without touching the account", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });

    await expect(
      changePassword({ currentPassword: "wrong", newPassword: NEW }),
    ).resolves.toEqual({ ok: false, reason: "wrong-password" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // The panel is hidden for Google accounts, but the browser does not get to
  // decide that: verifyUser derives the method from the account's identities.
  it("refuses an account that signs in with Google", async () => {
    mockIdentities = [{ provider: "google" }];

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: false, reason: "wrong-method" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // Sign-up refuses a breached password; without the same check here the floor
  // could be walked around from the inside.
  it("refuses a password that appears in a breach corpus", async () => {
    const suffix = (await sha1Upper(NEW)).slice(5);
    global.fetch = hibpAnswers(`${suffix}:4821`) as typeof fetch;

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: false, reason: "breached" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // Refusing a probably-fine password because someone else's service is down
  // is the worse failure — the same call sign-up makes.
  it("allows the change when the breach service is unreachable", async () => {
    global.fetch = hibpAnswers("", false) as typeof fetch;

    await changePassword({ currentPassword: CURRENT, newPassword: NEW });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: NEW });
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("stops at the rate limit before spending a guess", async () => {
    mockCheckRateLimit.mockResolvedValue("limited");

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: false, reason: "rate-limited" });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // The action re-parses what the panel already checked, because the panel is
  // not the only thing that can call it.
  it("refuses a new password over the 200-character ceiling", async () => {
    await expect(
      changePassword({
        currentPassword: CURRENT,
        newPassword: "x".repeat(201),
      }),
    ).resolves.toEqual({ ok: false, reason: "too-long" });
  });

  it("refuses a new password under the sign-up floor", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: "tooshort" }),
    ).resolves.toEqual({ ok: false, reason: "too-short" });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("refuses a new password identical to the current one", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: CURRENT }),
    ).resolves.toEqual({ ok: false, reason: "same-password" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("reports that the other sessions went", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: true, othersSignedOut: true });
  });

  // Supabase may reject the update even after local validation passes — e.g. its
  // own reuse policy. The password has not changed at that point, so no other
  // sessions need revoking.
  it("reports provider-refused when the update is rejected upstream", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "Password does not meet requirements" },
    });

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: false, reason: "provider-refused" });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // reauthAccount sends an account it cannot classify back to sign-in, and
  // redirect() works by throwing. A catch that treats every throw as a refusal
  // swallows the navigation and leaves the user on a form answering "couldn't
  // change your password" forever.
  it("lets a redirect out rather than reporting it as a refusal", async () => {
    mockEmail = null;

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  // supabase-js returns { error } for an ordinary failure, but a network drop
  // rejects. The password has already changed by then, so letting it escape
  // would report a failure that did not happen — and invite a retry that now
  // fails with "that isn't your current password".
  it("keeps the change when revoking throws rather than returning", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("network down"));

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: true, othersSignedOut: false });
  });

  // The password did change; saying otherwise would invite a second change
  // that revokes nothing either. But a session elsewhere has outlived the
  // password it was made with, so the caller is told rather than shown a
  // confirmation claiming every device was signed out.
  it("keeps the change but says so when the revoke fails", async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: "network" } });

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ ok: true, othersSignedOut: false });
    expect(mockLogError).toHaveBeenCalled();
  });
});

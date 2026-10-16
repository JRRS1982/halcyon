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

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            email: "test@example.com",
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

describe("changePassword", () => {
  beforeEach(() => {
    mockIdentities = [{ provider: "email" }];
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
    ).rejects.toThrow("Incorrect password");
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // The panel is hidden for Google accounts, but the browser does not get to
  // decide that: verifyUser derives the method from the account's identities.
  it("refuses an account that signs in with Google", async () => {
    mockIdentities = [{ provider: "google" }];

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).rejects.toThrow("That isn't how this account signs in");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // Sign-up refuses a breached password; without the same check here the floor
  // could be walked around from the inside.
  it("refuses a password that appears in a breach corpus", async () => {
    const suffix = (await sha1Upper(NEW)).slice(5);
    global.fetch = hibpAnswers(`${suffix}:4821`) as typeof fetch;

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).rejects.toThrow("That password has appeared in a data breach");
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
    ).rejects.toThrow("Too many attempts");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // The action re-parses what the panel already checked, because the panel is
  // not the only thing that can call it.
  it("refuses a new password under the sign-up floor", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: "tooshort" }),
    ).rejects.toThrow("Password must be at least 12 characters");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("refuses a new password identical to the current one", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: CURRENT }),
    ).rejects.toThrow("Choose a password you aren't already using");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("reports that the other sessions went", async () => {
    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ othersSignedOut: true });
  });

  // The password did change; saying otherwise would invite a second change
  // that revokes nothing either. But a session elsewhere has outlived the
  // password it was made with, so the caller is told rather than shown a
  // confirmation claiming every device was signed out.
  it("keeps the change but says so when the revoke fails", async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: "network" } });

    await expect(
      changePassword({ currentPassword: CURRENT, newPassword: NEW }),
    ).resolves.toEqual({ othersSignedOut: false });
    expect(mockLogError).toHaveBeenCalled();
  });
});

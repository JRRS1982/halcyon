/**
 * @jest-environment node
 */
const signInWithPassword = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const verifyOtp = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
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
      signInWithPassword: (args: unknown) => signInWithPassword(args),
      verifyOtp: (args: unknown) => verifyOtp(args),
    },
  }),
}));
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
}));
jest.mock("@/lib/log", () => ({ log: { warn: jest.fn(), error: jest.fn() } }));

const checkRateLimit = jest.fn(
  async (_action: string, _subject: string | null): Promise<string> =>
    "allowed",
);
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (action: string, subject: string | null) =>
    checkRateLimit(action, subject),
}));

import type { Reauthentication } from "@/lib/auth/reauth";
import { REAUTH_ERRORS, verifyUser } from "@/lib/auth/verifyUser";

describe("verifyUser", () => {
  beforeEach(() => {
    mockIdentities = [{ provider: "email" }];
    signInWithPassword.mockClear();
    verifyOtp.mockClear();
    checkRateLimit.mockClear();
  });

  // The proof is the one client-supplied object in the app that reaches a
  // security decision. Its TypeScript union is erased at runtime, so the cast
  // here is what a crafted request body actually looks like.
  it("refuses a proof whose shape is not one the app sends", async () => {
    const crafted = {
      method: "password",
      password: { $ne: null },
    } as unknown as Reauthentication;

    await expect(verifyUser(crafted)).rejects.toThrow();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses a code that is not six digits", async () => {
    mockIdentities = [{ provider: "google" }];
    const crafted = {
      method: "otp",
      code: ["000000", "000001"],
    } as unknown as Reauthentication;

    await expect(verifyUser(crafted)).rejects.toThrow();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  // An 8-digit code from a project whose OTP length had drifted reached the
  // user as "something went wrong", because a parse failure was not a refusal
  // the panel had words for. It is a bad code, and must say so.
  it("refuses a code of the wrong length as an invalid code", async () => {
    mockIdentities = [{ provider: "google" }];

    await expect(
      verifyUser({ method: "otp", code: "12345678" }),
    ).rejects.toThrow(REAUTH_ERRORS.badCode);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  // Which buckets a gate spends is the gate. Charging the OTP bucket for a
  // password attempt would leave password guessing bounded by a budget no
  // password attempt ever touches.
  it("charges the per-IP and per-account buckets for a password", async () => {
    await verifyUser({ method: "password", password: "hunter2hunter2" });

    expect(checkRateLimit).toHaveBeenCalledWith("verify-password", "1.2.3.4");
    expect(checkRateLimit).toHaveBeenCalledWith(
      "verify-password-account",
      "test@example.com",
    );
    expect(checkRateLimit).not.toHaveBeenCalledWith(
      "verify-code",
      expect.anything(),
    );
  });

  it("charges only the code bucket for an emailed code", async () => {
    mockIdentities = [{ provider: "google" }];

    await verifyUser({ method: "otp", code: "123456" });

    expect(checkRateLimit).toHaveBeenCalledWith(
      "verify-code",
      "test@example.com",
    );
    expect(checkRateLimit).not.toHaveBeenCalledWith(
      "verify-password",
      expect.anything(),
    );
  });
});

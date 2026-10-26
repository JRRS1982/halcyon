/**
 * @jest-environment node
 */
const mockResetPasswordForEmail = jest.fn(
  async (
    _email: string,
    _options: unknown,
  ): Promise<{ error: { message: string; status?: number } | null }> => ({
    error: null,
  }),
);

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      resetPasswordForEmail: (email: string, options: unknown) =>
        mockResetPasswordForEmail(email, options),
    },
  }),
}));

jest.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-for", "1.2.3.4"],
      ["origin", "https://balanced.money"],
    ]),
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

import { requestPasswordReset } from "@/app/(app)/forgot-password/actions";

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

const request = (email: string) => {
  const data = new FormData();
  data.set("email", email);
  return landsOn(requestPasswordReset(data));
};

describe("requestPasswordReset", () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue("allowed");
  });

  it("sends a link that opens the reset page", async () => {
    await request("someone@example.com");

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "someone@example.com",
      { redirectTo: "https://balanced.money/reset-password" },
    );
  });

  // If a failure looked different from a success, the form would tell anyone
  // which addresses have accounts here.
  it("answers the same whether or not the provider sent anything", async () => {
    const sent = await request("someone@example.com");
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: "User not found", status: 400 },
    });
    const notSent = await request("nobody@example.com");

    expect(notSent).toBe(sent);
    expect(sent).toBe("/forgot-password?success=1");
  });

  it("refuses an address that is not an email", async () => {
    await expect(request("not-an-email")).resolves.toBe(
      "/forgot-password?error=invalid-email",
    );
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("bounds how many reset emails one inbox can be sent", async () => {
    mockCheckRateLimit.mockImplementation(async (action) =>
      action === "password-reset-address" ? "limited" : "allowed",
    );

    await expect(request("someone@example.com")).resolves.toBe(
      "/forgot-password?error=too-many-attempts",
    );
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  // Every request sends an email, so a limiter outage pauses resets rather
  // than letting them through unbounded.
  it("sends nothing while the limiter is unavailable", async () => {
    mockCheckRateLimit.mockResolvedValue("unavailable");

    await expect(request("someone@example.com")).resolves.toBe(
      "/forgot-password?error=reset-unavailable",
    );
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });
});

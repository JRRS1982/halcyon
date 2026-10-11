/**
 * @jest-environment node
 */
const exchangeCodeForSession = jest.fn(async () => ({ error: null }));
const cookieSet = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
jest.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));
jest.mock("@/lib/log", () => ({ log: { error: jest.fn() } }));

import { GET } from "@/app/auth/callback/route";
import { ACTIVITY_COOKIE, parseActivity } from "@/lib/auth/sessionTimeout";

const callback = (url: string) => GET(new Request(url));

describe("auth callback", () => {
  beforeEach(() => cookieSet.mockClear());

  // The proxy treats an authenticated request with no readable activity cookie
  // as expired. The password form seeds that clock itself, but every session
  // born here — Google sign-in, email confirmation, magic link — arrived
  // without one, which after that guard landed the user straight back on
  // /sign-in. Seeding here is what keeps OAuth usable.
  it("starts the activity clock for a session it created", async () => {
    await callback("https://balanced.money/auth/callback?code=abc");

    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVITY_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    const [, value] = cookieSet.mock.calls[0] as [string, string, unknown];
    expect(parseActivity(value)).not.toBeNull();
  });

  it("does not start a clock when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "bad code" },
    } as never);

    await callback("https://balanced.money/auth/callback?code=bad");

    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("does not start a clock when there is no code at all", async () => {
    await callback("https://balanced.money/auth/callback");

    expect(cookieSet).not.toHaveBeenCalled();
  });
});

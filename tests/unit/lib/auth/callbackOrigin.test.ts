/**
 * @jest-environment node
 */
let siteUrl: string | undefined;
const headerOrigin = jest.fn(() => "https://evil.example");

jest.mock("@/lib/env", () => ({
  get emailEnv() {
    return { SITE_URL: siteUrl };
  },
}));
jest.mock("next/headers", () => ({
  headers: async () => ({ get: () => headerOrigin() }),
}));

import { callbackOrigin } from "@/lib/auth/callbackOrigin";

describe("callbackOrigin", () => {
  afterEach(() => {
    siteUrl = undefined;
  });

  // The whole point: a forged Origin header reached emailRedirectTo, so the
  // one-time code in a confirmation email could be pointed at another host.
  it("prefers the server's own SITE_URL over the request header", async () => {
    siteUrl = "https://balanced.money";
    await expect(callbackOrigin()).resolves.toBe("https://balanced.money");
  });

  // Local development and preview deploys have no fixed origin to know in
  // advance, and SITE_URL is required on production so this cannot apply there.
  it("falls back to the request header when SITE_URL is unset", async () => {
    await expect(callbackOrigin()).resolves.toBe("https://evil.example");
  });
});

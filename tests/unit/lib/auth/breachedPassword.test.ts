/**
 * @jest-environment node
 */
import { checkPasswordBreach } from "@/lib/auth/breachedPassword";

// SHA-1("password"), the canonical HIBP example. Hard-coded rather than
// recomputed with the same primitive the implementation uses, so that swapping
// the algorithm breaks this test instead of silently agreeing with itself.
const SHA1_PASSWORD = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const PREFIX = SHA1_PASSWORD.slice(0, 5);
const SUFFIX = SHA1_PASSWORD.slice(5);

// Typed with the arguments fetch actually receives, so the call-log assertion
// below can read the URL without casting through `any`.
const respondWith = (body: string, ok = true) =>
  jest.fn(
    async (_url: URL | RequestInfo, _init?: RequestInit) =>
      ({ ok, text: async () => body }) as unknown as Response,
  );

describe("checkPasswordBreach", () => {
  afterEach(() => {
    // @ts-expect-error — restoring the global between cases.
    global.fetch = undefined;
  });

  it("reports a password that appears in the range response", async () => {
    global.fetch = respondWith(`${SUFFIX}:12345\nAAAA:1`) as typeof fetch;
    await expect(checkPasswordBreach("password")).resolves.toBe("breached");
  });

  it("reports a password that does not appear", async () => {
    global.fetch = respondWith("0000000000000000000000000000000000A:3");
    await expect(checkPasswordBreach("password")).resolves.toBe("safe");
  });

  // HIBP returns uppercase; nothing says it must, and a lowercase body that
  // silently read as "safe" would be a breach check that never fires.
  it("matches the suffix regardless of case", async () => {
    global.fetch = respondWith(`${SUFFIX.toLowerCase()}:9`) as typeof fetch;
    await expect(checkPasswordBreach("password")).resolves.toBe("breached");
  });

  // k-anonymity is the whole point: only the first five hex characters leave
  // this process. If this ever fails, we are posting user passwords upstream.
  it("sends only the five-character prefix, never the password or full hash", async () => {
    const fetchMock = respondWith("");
    global.fetch = fetchMock as typeof fetch;

    await checkPasswordBreach("password");

    // Asserted as an exact URL rather than "does not contain the password":
    // the endpoint's own host is pwnedpasswords.com, which contains that
    // substring, so the negative form passes or fails for the wrong reason.
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
  });

  // Fails open, deliberately: HIBP being unreachable must not stop people
  // signing up. The caller logs it; it never blocks.
  it("reports unknown when the request throws", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(checkPasswordBreach("password")).resolves.toBe("unknown");
  });

  it("reports unknown on a non-OK response", async () => {
    global.fetch = respondWith("rate limited", false) as typeof fetch;
    await expect(checkPasswordBreach("password")).resolves.toBe("unknown");
  });
});

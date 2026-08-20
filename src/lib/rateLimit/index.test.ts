import { log } from "@/lib/log";
import { withinRateLimit } from "@/lib/rateLimit";
import { incrementWindow as store } from "@/lib/rateLimit/redis";

// Factory mock (not automock): the real redis.ts imports env.ts, which parses
// server env on load and throws in the test environment. A factory replaces the
// module without ever loading it.
jest.mock("@/lib/rateLimit/redis", () => ({ incrementWindow: jest.fn() }));
jest.mock("@/lib/log", () => ({ log: { warn: jest.fn() } }));

const incrementWindow = store as jest.MockedFunction<typeof store>;

describe("withinRateLimit", () => {
  afterEach(() => jest.resetAllMocks());

  it("allows requests up to the limit", async () => {
    incrementWindow.mockResolvedValueOnce(10);
    await expect(withinRateLimit("sign-in", "1.2.3.4")).resolves.toBe(true);
  });

  it("blocks once the count exceeds the limit", async () => {
    incrementWindow.mockResolvedValueOnce(11);
    await expect(withinRateLimit("sign-in", "1.2.3.4")).resolves.toBe(false);
  });

  it("keys per action and per IP (hashed, never the raw address)", async () => {
    incrementWindow.mockResolvedValue(1);
    await withinRateLimit("sign-up", "9.9.9.9");
    const [key] = incrementWindow.mock.calls[0] as [string, number];
    expect(key).toMatch(/^rl:sign-up:[0-9a-f]{64}$/);
    expect(key).not.toContain("9.9.9.9");
  });

  it("no-ops (allows) when no store is configured", async () => {
    incrementWindow.mockResolvedValueOnce(null);
    await expect(withinRateLimit("sign-in", "1.2.3.4")).resolves.toBe(true);
  });

  it("fails open (and logs) when the store throws", async () => {
    incrementWindow.mockRejectedValueOnce(new Error("redis down"));
    await expect(withinRateLimit("sign-in", "1.2.3.4")).resolves.toBe(true);
    expect(log.warn).toHaveBeenCalled();
  });

  it("allows when there is no IP to key on", async () => {
    await withinRateLimit("sign-in", null);
    expect(incrementWindow).not.toHaveBeenCalled();
  });
});

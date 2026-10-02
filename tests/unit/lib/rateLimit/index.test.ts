import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { incrementWindow as store } from "@/lib/rateLimit/redis";

// Factory mock (not automock): the real redis.ts imports env.ts, which parses
// server env on load and throws in the test environment. A factory replaces the
// module without ever loading it.
jest.mock("@/lib/rateLimit/redis", () => ({ incrementWindow: jest.fn() }));
jest.mock("@/lib/log", () => ({ log: { warn: jest.fn(), error: jest.fn() } }));

const incrementWindow = store as jest.MockedFunction<typeof store>;

const keyOf = (call: number): string =>
  (incrementWindow.mock.calls[call] as [string, number])[0];

const windowOf = (call: number): number =>
  (incrementWindow.mock.calls[call] as [string, number])[1];

describe("checkRateLimit", () => {
  afterEach(() => jest.resetAllMocks());

  it("allows requests up to the limit", async () => {
    incrementWindow.mockResolvedValueOnce(10);
    await expect(checkRateLimit("sign-in", "1.2.3.4")).resolves.toBe("allowed");
  });

  it("limits once the count exceeds the limit", async () => {
    incrementWindow.mockResolvedValueOnce(11);
    await expect(checkRateLimit("sign-in", "1.2.3.4")).resolves.toBe("limited");
  });

  it("keys per action and per subject (hashed, never the raw value)", async () => {
    incrementWindow.mockResolvedValue(1);
    await checkRateLimit("sign-up", "9.9.9.9");
    expect(keyOf(0)).toMatch(/^rl:sign-up:[0-9a-f]{64}$/);
    expect(keyOf(0)).not.toContain("9.9.9.9");
  });

  it("buckets an email regardless of case and whitespace", async () => {
    incrementWindow.mockResolvedValue(1);
    await checkRateLimit("sign-in-account", "Someone@Example.com");
    await checkRateLimit("sign-in-account", "  someone@example.com ");
    expect(keyOf(0)).toBe(keyOf(1));
    expect(keyOf(0)).not.toContain("example");
  });

  it("gives the per-address windows an hour, the per-IP windows a minute", async () => {
    incrementWindow.mockResolvedValue(1);
    await checkRateLimit("sign-in", "1.2.3.4");
    await checkRateLimit("sign-in-account", "a@b.com");
    await checkRateLimit("sign-up-address", "a@b.com");
    expect(windowOf(0)).toBe(60);
    expect(windowOf(1)).toBe(3600);
    expect(windowOf(2)).toBe(3600);
  });

  it("allows only three confirmation emails per address per hour", async () => {
    incrementWindow.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    await expect(checkRateLimit("sign-up-address", "a@b.com")).resolves.toBe(
      "allowed",
    );
    await expect(checkRateLimit("sign-up-address", "a@b.com")).resolves.toBe(
      "limited",
    );
  });

  it("no-ops (allows) when no store is configured", async () => {
    incrementWindow.mockResolvedValueOnce(null);
    await expect(checkRateLimit("sign-up", "1.2.3.4")).resolves.toBe("allowed");
    expect(log.error).not.toHaveBeenCalled();
  });

  it("fails open for sign-in when the store throws, and logs an error", async () => {
    incrementWindow.mockRejectedValueOnce(new Error("redis down"));
    await expect(checkRateLimit("sign-in", "1.2.3.4")).resolves.toBe("allowed");
    expect(log.error).toHaveBeenCalledWith(
      "Rate limiter store unavailable",
      expect.objectContaining({ action: "sign-in", outcome: "allow" }),
    );
  });

  it("fails closed for sign-up when the store throws, and logs an error", async () => {
    incrementWindow.mockRejectedValue(new Error("redis down"));
    await expect(checkRateLimit("sign-up", "1.2.3.4")).resolves.toBe(
      "unavailable",
    );
    await expect(checkRateLimit("sign-up-address", "a@b.com")).resolves.toBe(
      "unavailable",
    );
    expect(log.error).toHaveBeenCalledTimes(2);
  });

  it("allows when there is no subject to key on", async () => {
    await expect(checkRateLimit("sign-in", null)).resolves.toBe("allowed");
    expect(incrementWindow).not.toHaveBeenCalled();
  });
});

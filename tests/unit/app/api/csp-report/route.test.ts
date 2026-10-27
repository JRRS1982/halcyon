/**
 * @jest-environment node
 */
jest.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]),
}));

// The real limiter and counter, over an in-memory Redis: see fakeRateLimitStore.
jest.mock("@/lib/rateLimit/redis", () =>
  jest.requireActual("@test/support/fakeRateLimitStore"),
);

jest.mock("@/lib/log", () => ({ log: { warn: jest.fn(), error: jest.fn() } }));

import { exhaust, resetStore } from "@test/support/fakeRateLimitStore";
import { POST } from "@/app/api/csp-report/route";
import { incrementWindow } from "@/lib/rateLimit/redis";

const report = {
  "csp-report": {
    "document-uri": "https://www.balanced.money/",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example/x.js",
  },
};

const send = (body: string) =>
  POST(
    new Request("https://www.balanced.money/api/csp-report", {
      method: "POST",
      body,
    }),
  );

// The fake store's own counter for a key, read by incrementing it once more.
const countFor = async (key: string) =>
  ((await incrementWindow(key, 1)) ?? 0) - 1;

describe("POST /api/csp-report", () => {
  beforeEach(() => resetStore());

  // The whole point of the trial: a count that is still there in a week.
  it("counts each violation by rule and blocked host", async () => {
    await send(JSON.stringify(report));
    const response = await send(JSON.stringify(report));

    expect(response.status).toBe(204);
    await expect(countFor("csp:script-src-elem:evil.example")).resolves.toBe(2);
  });

  it("refuses a body that is not a violation report", async () => {
    expect((await send("{}")).status).toBe(400);
    expect((await send("not json")).status).toBe(400);
  });

  it("refuses an oversized body without reading it as a report", async () => {
    expect((await send("x".repeat(20_000))).status).toBe(413);
  });

  // Unauthenticated, and every report writes to Redis.
  it("stops counting once one client has sent too many", async () => {
    exhaust("csp-report");

    expect((await send(JSON.stringify(report))).status).toBe(429);
    await expect(countFor("csp:script-src-elem:evil.example")).resolves.toBe(0);
  });
});

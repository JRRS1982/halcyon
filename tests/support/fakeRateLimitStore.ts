import { createHash } from "node:crypto";
import type { RateLimitedAction } from "@/lib/rateLimit";

// An in-memory stand-in for Upstash Redis, the one thing the rate limiter does
// not own. Tests replace `@/lib/rateLimit/redis` with this module and keep the
// real limiter, so its policies — the limits, the windows, which buckets fail
// closed when the store is down — run exactly as they do in production.
//
// Wire it up with:
//   jest.mock("@/lib/rateLimit/redis", () =>
//     jest.requireActual("@test/support/fakeRateLimitStore"),
//   );
// then import the controls below from "@test/support/fakeRateLimitStore".

const counts = new Map<string, number>();
const exhausted = new Set<RateLimitedAction>();
let isDown = false;

// The same key the limiter builds: the action plus a hash of the case-folded
// subject. Kept here so a test can ask about a bucket by name.
const keyFor = (action: RateLimitedAction, subject: string): string =>
  `rl:${action}:${createHash("sha256").update(subject.trim().toLowerCase()).digest("hex")}`;

const actionOf = (key: string): string => key.split(":")[1] ?? "";

// Replaces redis.ts's export of the same name. Checked against the real
// signature, so a change there fails the type check here instead of leaving
// every test green over a fake that no longer matches.
export const incrementWindow = (async (
  key: string,
  _windowSeconds: number,
): Promise<number | null> => {
  if (isDown) throw new Error("fake store unavailable");
  if (exhausted.has(actionOf(key) as RateLimitedAction)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  return next;
}) satisfies typeof import("@/lib/rateLimit/redis")["incrementWindow"];

/** Every bucket empty, every action under its limit, the store reachable. */
export const resetStore = (): void => {
  counts.clear();
  exhausted.clear();
  isDown = false;
};

/** Every subject in this bucket is over its limit from now on. */
export const exhaust = (action: RateLimitedAction): void => {
  exhausted.add(action);
};

/** The store throws, as Upstash does during an outage. */
export const takeStoreDown = (): void => {
  isDown = true;
};

/** How many times this bucket has been charged for this subject. */
export const chargesTo = (action: RateLimitedAction, subject: string): number =>
  counts.get(keyFor(action, subject)) ?? 0;

/** Which buckets have been charged at all, in no particular order. */
export const chargedActions = (): string[] => [
  ...new Set([...counts.keys()].map(actionOf)),
];

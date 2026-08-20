import { createHash } from "node:crypto";
import { log } from "@/lib/log";
import { incrementWindow } from "@/lib/rateLimit/redis";

// App-side per-IP rate limiter for the unauthenticated auth endpoints.
//
// Supabase throttles auth by IP, but every call reaches it from Vercel's egress
// IPs (see src/lib/supabase/server.ts), so this layer keys on the real client
// IP to bound brute-force (sign-in) and confirmation-email spam (sign-up).
//
// Deep module: callers only ask "is this request within the limit?" — the
// store, the hashing and the window all live behind this one function.

export type RateLimitedAction = "sign-in" | "sign-up";

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;

// The IP is personal data, so it is never stored: the key holds only its
// SHA-256 digest, which is enough to count requests from the same client.
const hashIp = (ip: string): string =>
  createHash("sha256").update(ip).digest("hex");

// True when the request may proceed, false when it should be blocked.
//
// Fails OPEN by design: a missing store (Redis not configured — local, CI,
// preview) or a Redis error allows the request and logs, so a cache outage
// degrades protection rather than becoming a sign-in/sign-up outage for
// everyone. A request with no client IP can't be keyed, so it is allowed.
export const withinRateLimit = async (
  action: RateLimitedAction,
  ip: string | null,
): Promise<boolean> => {
  if (!ip) return true;

  try {
    const count = await incrementWindow(
      `rl:${action}:${hashIp(ip)}`,
      WINDOW_SECONDS,
    );
    if (count === null) return true;
    return count <= MAX_ATTEMPTS;
  } catch (err) {
    log.warn("Rate limiter unavailable; allowing request", { action, err });
    return true;
  }
};

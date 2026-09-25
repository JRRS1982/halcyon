import { createHash } from "node:crypto";
import { log } from "@/lib/log";
import { incrementWindow } from "@/lib/rateLimit/redis";

// App-side rate limiter for the unauthenticated auth endpoints and sensitive
// authenticated actions.
//
// Supabase throttles auth by IP, but every call reaches it from Vercel's egress
// IPs (see src/lib/supabase/server.ts), so this layer keys on the real client
// IP to bound brute-force (sign-in) and confirmation-email spam (sign-up), and
// on the submitted email so that a pool of IPs cannot multiply the per-IP
// allowance against one account or one inbox.
//
// Deep module: callers only ask "may this request proceed?" — the store, the
// hashing, the windows and the outage behaviour all live behind one function.

export type RateLimitedAction =
  | "sign-in" // per client IP
  | "sign-in-account" // per submitted email: distributed guessing at one account
  | "sign-up" // per client IP
  | "sign-up-address" // per submitted email: confirmation-mail bombing of one inbox
  | "verify-password" // per client IP: re-auth before destructive actions
  | "verify-password-account" // per account email: cross-IP guessing at one account
  | "unsubscribe" // per client IP: unauthenticated RFC 8058 endpoint
  | "data-export" // per userId: heavy 10-table fan-out
  | "oauth-initiate" // per client IP: OAuth flow initiation
  | "health";

export type RateLimitVerdict = "allowed" | "limited" | "unavailable";

type Policy = {
  windowSeconds: number;
  maxAttempts: number;
  // What to do when the store is configured but unreachable. Sign-in fails open
  // so a cache outage is never a sign-in outage — Supabase's own throttle still
  // stands behind it. Sign-up fails closed: every call sends an email, so an
  // unbounded window there costs sender reputation and the project's mail
  // quota, and a brief pause on new sign-ups is the cheaper failure.
  whenStoreFails: "allow" | "block";
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;

const POLICIES: Record<RateLimitedAction, Policy> = {
  "sign-in": {
    windowSeconds: MINUTE,
    maxAttempts: 10,
    whenStoreFails: "allow",
  },
  "sign-in-account": {
    windowSeconds: HOUR,
    maxAttempts: 20,
    whenStoreFails: "allow",
  },
  "sign-up": {
    windowSeconds: MINUTE,
    maxAttempts: 10,
    whenStoreFails: "block",
  },
  "sign-up-address": {
    windowSeconds: HOUR,
    maxAttempts: 3,
    whenStoreFails: "block",
  },
  // Tighter than sign-in: gating irreversible operations, so a brief Redis
  // outage is still acceptable (fail open), but the window is shorter.
  "verify-password": {
    windowSeconds: MINUTE,
    maxAttempts: 5,
    whenStoreFails: "allow",
  },
  "verify-password-account": {
    windowSeconds: HOUR,
    maxAttempts: 10,
    whenStoreFails: "allow",
  },
  // Unauthenticated — fail open so a Redis outage never blocks RFC 8058
  // one-click unsubscribes from mail clients, which must not be broken.
  unsubscribe: {
    windowSeconds: MINUTE,
    maxAttempts: 20,
    whenStoreFails: "allow",
  },
  // Authenticated export: heavy 10-table fan-out; keyed on userId via subject.
  "data-export": {
    windowSeconds: MINUTE,
    maxAttempts: 2,
    whenStoreFails: "allow",
  },
  // OAuth initiation: Supabase's own throttle sees Vercel egress IPs, not the
  // real client, so we add an app-side per-IP gate here.
  "oauth-initiate": {
    windowSeconds: MINUTE,
    maxAttempts: 10,
    whenStoreFails: "allow",
  },
  health: { windowSeconds: MINUTE, maxAttempts: 10, whenStoreFails: "allow" },
};

// The subject (an IP or an email) is personal data, so it is never stored: the
// key holds only its SHA-256 digest, which is enough to count requests from the
// same client. Case-folded first so that A@x.com and a@x.com share a bucket.
const hashSubject = (subject: string): string =>
  createHash("sha256").update(subject.trim().toLowerCase()).digest("hex");

// "allowed" when the request may proceed; "limited" when this subject has used
// its window; "unavailable" when the store failed and the action's policy says
// to block rather than allow.
//
// No store configured at all (local, CI, preview — see src/lib/env.ts) means
// the limiter is switched off by deployment choice and every request is
// allowed. A store that is configured but throws is an outage, logged at error
// level so it is noticed rather than silently degrading, and the policy
// decides. A request with no subject cannot be keyed, so it is allowed.
export const checkRateLimit = async (
  action: RateLimitedAction,
  subject: string | null,
): Promise<RateLimitVerdict> => {
  if (!subject) return "allowed";
  const policy = POLICIES[action];

  try {
    const count = await incrementWindow(
      `rl:${action}:${hashSubject(subject)}`,
      policy.windowSeconds,
    );
    if (count === null) return "allowed";
    return count <= policy.maxAttempts ? "allowed" : "limited";
  } catch (err) {
    log.error("Rate limiter store unavailable", {
      action,
      outcome: policy.whenStoreFails,
      err,
    });
    return policy.whenStoreFails === "allow" ? "allowed" : "unavailable";
  }
};

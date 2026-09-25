# Rate Limiting

**What:** Per-action sliding-window limits via Upstash Ratelimit; fails open on Redis unavailability (except sign-up, which fails closed).  
**Key points:**
- Two buckets per sensitive action: per-IP (brute-force) + per-account/email (credential stuffing)
- `checkRateLimit(action, key)` in `src/lib/rateLimit/index.ts` — returns `"allowed"` or throws/returns 429
- `whenStoreFails: "allow"` on all actions except sign-up; Redis outage does not block real users
- IPs stored as SHA-256 hashes in Upstash — not plaintext; compliant with GDPR's data minimisation principle

Application-level rate limiting via Upstash Ratelimit. Implemented in `src/lib/rateLimit/index.ts`.

## Policy registry

| Action | Key | Window | Max attempts | On Redis failure |
|--------|-----|--------|-------------|-----------------|
| `sign-in` | Client IP | 1 min | 10 | allow |
| `sign-in-account` | Submitted email | 1 hour | 20 | allow |
| `sign-up` | Client IP | 1 min | 10 | **block** |
| `sign-up-address` | Submitted email | 1 hour | 3 | **block** |
| `verify-password` | Client IP | 1 min | 5 | allow |
| `verify-password-account` | Account email | 1 hour | 10 | allow |
| `unsubscribe` | Client IP | 1 min | 20 | allow |
| `data-export` | userId | 1 min | 2 | allow |
| `oauth-initiate` | Client IP | 1 min | 10 | allow |
| `health` | Client IP | 1 min | 10 | allow |

Sign-up fails **closed** (blocks on Redis outage) because each call sends a confirmation email — an unbounded window burns sender reputation and the project's mail quota. All other actions fail open.

## Fail-open

`whenStoreFails: "allow"` means a Redis outage degrades to no rate limiting, not to a 429. The failure is logged at error level so it is noticed. A missing store configuration (local dev, CI, preview) switches the limiter off entirely — every request is allowed without a log entry.

## Key hashing

The subject (IP address or email) is never stored. The Redis key holds only its SHA-256 digest after case-folding and trimming: `rl:<action>:<sha256(subject)>`. This means `A@x.com` and `a@x.com` share a bucket, and raw PII is never in the cache.

A null subject (no IP resolvable) is always allowed — never blocked on a missing key.

## Two-bucket pattern

Credential endpoints (`sign-in`, `verify-password`) run **two** `checkRateLimit` calls in parallel:

- **Per-IP**: bounds a single attacker hitting many accounts from one location
- **Per-account** (email): bounds a pool of IPs targeting the same account

Either bucket returning `"limited"` is enough to reject the request. This prevents both attack shapes without requiring a single bucket to cover both.

## `clientIp()`

`src/lib/http/clientIp.ts` — reads `x-forwarded-for` (first hop, set by Vercel's edge, not spoofable) then falls back to `x-real-ip`. Returns `null` when neither header is present. Works in both Server Actions and Route Handlers via Next.js `headers()`.

## Where each limit is enforced

| Action | File |
|--------|------|
| `sign-in` / `sign-in-account` | `src/app/sign-in/actions.ts` |
| `sign-up` / `sign-up-address` | `src/app/sign-up/actions.ts` |
| `verify-password` / `verify-password-account` | `src/app/(app)/settings/dataActions.ts` |
| `oauth-initiate` | `src/app/auth/oauth-actions.ts` |
| `data-export` | `src/app/(app)/settings/dataActions.ts` |
| `unsubscribe` | `src/app/api/unsubscribe/route.ts` |
| `health` | `src/app/api/health/route.ts` |

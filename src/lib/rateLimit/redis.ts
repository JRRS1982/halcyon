import { rateLimitEnv } from "@/lib/env";
import { Redis } from "@upstash/redis";

// The Redis store behind the rate limiter, kept separate from the policy in
// index.ts so the transport can be swapped without touching call sites.
//
// Upstash Redis is a managed, standalone service reached over HTTPS — the only
// kind of Redis that works cleanly on Vercel serverless/edge, where a
// per-invocation TCP connection would be an anti-pattern. Both env vars are
// optional (see src/lib/env.ts): when either is absent there is no store, and
// the limiter no-ops.

let cached: Redis | null | undefined;

const client = (): Redis | null => {
  if (cached !== undefined) return cached;
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = rateLimitEnv;
  cached =
    UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
      ? new Redis({
          url: UPSTASH_REDIS_REST_URL,
          token: UPSTASH_REDIS_REST_TOKEN,
        })
      : null;
  return cached;
};

// Increments the counter at `key`, setting the window TTL on the first hit so
// the key self-expires (nothing persists past the window). Returns the new
// count, or null when no store is configured.
export const incrementWindow = async (
  key: string,
  windowSeconds: number,
): Promise<number | null> => {
  const redis = client();
  if (!redis) return null;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
};

/**
 * @jest-environment node
 *
 * Node rather than jsdom, for the same reason as env.test.ts: the server half
 * of the schema is guarded on `typeof window === "undefined"`, so under jsdom
 * rateLimitEnv is `{}` and every case here would pass for the wrong reason.
 *
 * The limiter's env vars are optional everywhere except a production Vercel
 * deploy, where an absent store would silently turn every rate limit into
 * "allowed". These cover both halves of that rule.
 */
const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  SUPABASE_SECRET_KEY: "sb_secret_abc",
  DATABASE_URL: "postgresql://postgres:postgres@db:5432/halcyon",
};

const LIMITER = {
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token-abc",
};

// Suffixed names rather than bare `load`/`original`: env.test.ts and
// env.email.test.ts load env.ts dynamically too, and with no top-level
// import/export TypeScript treats all three as global scripts sharing one
// scope, where identical helper names collide (TS2451).
const originalEnvForLimiter = { ...process.env };

// `delete` rather than assigning undefined: process.env coerces, so assigning
// undefined stores the string "undefined", which parses fine and would quietly
// defeat the "not set" cases below.
const loadEnvForLimiter = (overrides: Record<string, string>) => {
  jest.resetModules();
  for (const key of [
    ...Object.keys(BASE),
    ...Object.keys(LIMITER),
    "VERCEL_ENV",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) {
    process.env[key] = value;
  }
  return import("@/lib/env");
};

const limiterFailureFor = async (overrides: Record<string, string>) => {
  try {
    await loadEnvForLimiter(overrides);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected env validation to fail, but it passed");
};

afterEach(() => {
  process.env = { ...originalEnvForLimiter };
});

describe("rate limiter env", () => {
  it("is optional off Vercel, where the limiter is meant to no-op", async () => {
    const { rateLimitEnv } = await loadEnvForLimiter({});

    expect(rateLimitEnv.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(rateLimitEnv.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it("is optional on a preview deploy, which has no Redis", async () => {
    const { rateLimitEnv } = await loadEnvForLimiter({ VERCEL_ENV: "preview" });

    expect(rateLimitEnv.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it("refuses to boot a production deploy with no store configured", async () => {
    const message = await limiterFailureFor({ VERCEL_ENV: "production" });

    expect(message).toContain("UPSTASH_REDIS_REST_URL (not set)");
    expect(message).toContain("UPSTASH_REDIS_REST_TOKEN (not set)");
  });

  it("refuses to boot a production deploy holding only half the pair", async () => {
    const message = await limiterFailureFor({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: LIMITER.UPSTASH_REDIS_REST_URL,
    });

    expect(message).toContain("UPSTASH_REDIS_REST_TOKEN (not set)");
  });

  // Compose substitutes "" for a variable it cannot resolve, so blank has to
  // fail production the same way absent does rather than slipping through.
  it("treats a blank value in production as absent", async () => {
    const message = await limiterFailureFor({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });

    expect(message).toContain("UPSTASH_REDIS_REST_URL (empty)");
  });

  it("boots a production deploy when the store is configured", async () => {
    const { rateLimitEnv } = await loadEnvForLimiter({
      VERCEL_ENV: "production",
      ...LIMITER,
    });

    expect(rateLimitEnv.UPSTASH_REDIS_REST_URL).toBe(
      LIMITER.UPSTASH_REDIS_REST_URL,
    );
  });
});

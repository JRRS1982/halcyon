import { z } from "zod";

// Runtime environment validation (ADR-004). Parsed once on first import: a
// missing or malformed value throws here with a clear message instead of
// surfacing as a cryptic Supabase/Prisma error deep inside a request. Surfaced
// at server startup via src/instrumentation.ts.

// NEXT_PUBLIC_* are inlined into the browser bundle, so they are validated in
// every runtime. Server-only secrets must never be read in the browser (or in
// the edge proxy, which has no DB), so their parse is guarded below.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

// Mail + cron. Optional, unlike everything above: the app is fully functional
// without sending email, and local dev, CI and preview deploys all run without
// these. Required-here would mean every contributor and every CI job had to
// hold a Resend key to run the test suite. Callers check isEmailConfigured()
// and skip instead — see src/lib/email/send.ts.
//
// Blank counts as absent. Docker Compose substitutes an empty string for a
// variable it cannot resolve, so `- CRON_SECRET=${CRON_SECRET}` in compose.yaml
// with nothing set delivers "" rather than nothing at all. Without this,
// `.min(1)` rejects it and the entire app refuses to boot — over a feature that
// is switched off. An optional variable has to be genuinely optional in every
// way it can arrive.
const blankAsAbsent = (value: unknown) => (value === "" ? undefined : value);

const emailSchema = z.object({
  RESEND_API_KEY: z.preprocess(blankAsAbsent, z.string().min(1).optional()),
  EMAIL_FROM: z.preprocess(blankAsAbsent, z.string().min(1).optional()),
  // Absolute origin for links in emails. There is no request to derive it from
  // inside a cron job, and a relative URL in an inbox goes nowhere.
  SITE_URL: z.preprocess(blankAsAbsent, z.string().url().optional()),
  // Vercel sends this as a bearer on scheduled invocations. Without it the cron
  // route refuses to run at all rather than standing open — see the route.
  CRON_SECRET: z.preprocess(blankAsAbsent, z.string().min(1).optional()),
});

const parse = <T extends z.ZodType>(
  schema: T,
  values: Record<string, unknown>,
): z.infer<T> => {
  const result = schema.safeParse(values);
  if (result.success) return result.data;

  // Empty is worth telling apart from absent: Docker Compose substitutes an
  // empty string for a variable it can't resolve (it warns "Defaulting to a
  // blank string" and starts the container anyway), so a blank one means this
  // checkout has no .env — not that nothing passes the value through.
  //
  // Never the value itself; two of these are secrets and boot errors get pasted
  // into chats.
  const faults = result.error.issues.map((issue) => {
    const key = issue.path.join(".");
    const value = values[key];
    if (value === undefined) return `${key} (not set)`;
    if (value === "") return `${key} (empty)`;
    return `${key} (${issue.message})`;
  });

  throw new Error(
    `Invalid environment variables: ${faults.join(", ")}. See .env.example.`,
  );
};

// Per-key references (not a loop) so Next can statically inline NEXT_PUBLIC_*.
const publicEnv = parse(publicSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const isServer =
  typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge";

const serverEnv = isServer
  ? parse(serverSchema, {
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
    })
  : (undefined as unknown as z.infer<typeof serverSchema>);

export const env = { ...publicEnv, ...serverEnv };

// Exported separately rather than merged into `env`: these are all optional, so
// folding them in would make `env.RESEND_API_KEY` a `string | undefined` on a
// object whose whole point is that its members are guaranteed present.
export const emailEnv: z.infer<typeof emailSchema> = isServer
  ? parse(emailSchema, {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      SITE_URL: process.env.SITE_URL,
      CRON_SECRET: process.env.CRON_SECRET,
    })
  : {};

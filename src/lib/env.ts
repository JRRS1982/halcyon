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

const parse = <T extends z.ZodType>(schema: T, values: unknown): z.infer<T> => {
  const result = schema.safeParse(values);
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid environment variables: ${missing}. See .env.example.`,
    );
  }
  return result.data;
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

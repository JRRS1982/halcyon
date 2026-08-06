/**
 * @jest-environment node
 *
 * Node rather than jsdom: the server half of the schema is guarded on
 * `typeof window === "undefined"`, so under jsdom it would never be checked and
 * half of these would pass for the wrong reason. The pragma has to be the first
 * comment in the file — a `//` line above it and jest ignores the block.
 *
 * env.ts validates at import, so each case reloads the module against a
 * doctored process.env.
 */
const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
] as const;

const VALID: Record<(typeof KEYS)[number], string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  SUPABASE_SECRET_KEY: "sb_secret_abc",
  DATABASE_URL: "postgresql://postgres:postgres@db:5432/halcyon",
};

const original = { ...process.env };

// `delete` rather than assigning undefined: process.env coerces, so
// `process.env.FOO = undefined` stores the string "undefined", which parses
// fine and would quietly defeat the "not set" case.
const load = (overrides: Partial<Record<(typeof KEYS)[number], string>>) => {
  jest.resetModules();
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides))
    process.env[key] = value;
  return import("@/lib/env");
};

const failureFor = async (
  overrides: Partial<Record<(typeof KEYS)[number], string>>,
) => {
  try {
    await load(overrides);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected env validation to fail, but it passed");
};

afterEach(() => {
  process.env = { ...original };
});

describe("env validation", () => {
  test("parses a complete environment", async () => {
    const { env } = await load(VALID);

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(VALID.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
  });

  test("names an unset variable as not set", async () => {
    const message = await failureFor({
      ...VALID,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
    });

    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL (not set)");
  });

  // The Docker case, and the reason empty is told apart from absent: Compose
  // resolves an unknown variable to "" and starts the container anyway, so
  // inside it the value is blank rather than missing.
  test("names a blank variable as empty", async () => {
    const message = await failureFor({ ...VALID, SUPABASE_SECRET_KEY: "" });

    expect(message).toContain("SUPABASE_SECRET_KEY (empty)");
  });

  test("gives zod's reason when the value is present but wrong", async () => {
    const message = await failureFor({
      ...VALID,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    });

    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL (");
    expect(message).not.toContain("(not set)");
    expect(message).not.toContain("(empty)");
  });

  // Two of these are secrets, and a boot failure is often the first thing
  // pasted into a chat or an issue.
  test("never quotes the failing value back", async () => {
    const leaked = "sb_secret_do_not_print_me";

    const message = await failureFor({
      ...VALID,
      NEXT_PUBLIC_SUPABASE_URL: leaked,
    });

    expect(message).not.toContain(leaked);
  });
});

/**
 * @jest-environment node
 *
 * The mail and cron variables are optional, and this pins what "optional"
 * has to mean in practice. env.ts validates at import, so each case reloads
 * the module against a doctored process.env.
 */
const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  SUPABASE_SECRET_KEY: "sb_secret_abc",
  DATABASE_URL: "postgresql://postgres:postgres@db:5432/halcyon",
};

const OPTIONAL = ["RESEND_API_KEY", "EMAIL_FROM", "SITE_URL", "CRON_SECRET"];

const original = { ...process.env };

const load = (overrides: Record<string, string> = {}) => {
  jest.resetModules();
  // `delete`, not undefined: process.env coerces, so assigning undefined
  // stores the string "undefined".
  for (const key of [...Object.keys(REQUIRED), ...OPTIONAL]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries({ ...REQUIRED, ...overrides })) {
    process.env[key] = value;
  }
  return import("@/lib/env");
};

afterEach(() => {
  process.env = { ...original };
});

describe("optional mail + cron env", () => {
  test("absent is fine — the app runs without email configured", async () => {
    const { emailEnv } = await load();

    expect(emailEnv).toEqual({});
  });

  /**
   * The one that bit in practice. Docker Compose substitutes an empty string
   * for a variable it cannot resolve, so `- CRON_SECRET=${CRON_SECRET}` in
   * compose.yaml with nothing set delivers "" rather than nothing. Before this,
   * `.min(1)` rejected it and the whole app refused to boot — over a feature
   * that is switched off.
   */
  test.each(
    OPTIONAL,
  )("a blank %s reads as absent, not invalid", async (key) => {
    const { emailEnv } = await load({ [key]: "" });

    expect(emailEnv[key as keyof typeof emailEnv]).toBeUndefined();
  });

  test("every optional var blank at once still boots", async () => {
    const blanks = Object.fromEntries(OPTIONAL.map((k) => [k, ""]));

    await expect(load(blanks)).resolves.toBeDefined();
  });

  test("a real value still comes through", async () => {
    const { emailEnv } = await load({
      CRON_SECRET: "s3cret",
      SITE_URL: "https://balanced.money",
    });

    expect(emailEnv.CRON_SECRET).toBe("s3cret");
    expect(emailEnv.SITE_URL).toBe("https://balanced.money");
  });

  // Leniency about blanks must not become leniency about wrong values — a
  // malformed SITE_URL puts dead links in real email.
  test("a malformed value is still rejected", async () => {
    await expect(load({ SITE_URL: "not-a-url" })).rejects.toThrow(/SITE_URL/);
  });
});

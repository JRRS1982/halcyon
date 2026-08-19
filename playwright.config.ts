import { defineConfig, devices } from "@playwright/test";

const testAppPort = Number(process.env.PLAYWRIGHT_APP_PORT ?? 3100);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${testAppPort}`;
const isCI = !!process.env.CI;

const mockSupabasePort = 54321;
const mockSupabaseURL = `http://localhost:${mockSupabasePort}`;

export default defineConfig({
  testDir: "./e2e",
  // Auth tests share an in-memory user store in the mock; run serially.
  fullyParallel: false,
  // `.only` is a legitimate local tool and a disaster in CI, where it would
  // quietly narrow the run to one test and still report green.
  forbidOnly: isCI,
  // No second chances anywhere: a test that needs one is a test to fix. This is
  // also what keeps a local run and a CI run comparable — retries were the last
  // thing that made them disagree.
  retries: 0,
  // Belt and braces: retries can still be turned on from the command line, and
  // this makes sure a test rescued by one still fails the run.
  failOnFlakyTests: true,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    // Not "on-first-retry": with retries off there is no retry to trace on, and
    // a failure with no trace is a failure you debug twice.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/_mock/supabase.mjs",
      url: `${mockSupabaseURL}/health`,
      // Never reuse: a second local run used to silently attach to the first
      // one's servers and then truncate halcyon_test underneath it, which reads
      // as random tests failing in both runs. Now the second run stops with
      // "port already in use", which is the truth.
      reuseExistingServer: false,
      // stdout left at Playwright's default ("ignore"): the mock logs every
      // auth request it serves, and signIn() runs in nearly every spec, so
      // piping it buries the test output. stderr stays piped (also the
      // default), so anything that actually goes wrong still surfaces.
      stderr: "pipe",
    },
    {
      command: `pnpm next dev -p ${testAppPort}`,
      url: baseURL,
      // Never reuse: a second local run used to silently attach to the first
      // one's servers and then truncate halcyon_test underneath it, which reads
      // as random tests failing in both runs. Now the second run stops with
      // "port already in use", which is the truth.
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        // Point the app at the mock Supabase instead of the real project.
        NEXT_PUBLIC_SUPABASE_URL: mockSupabaseURL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_test_anon_key_for_e2e",
        // src/lib/env.ts validates this at boot (via instrumentation.ts); the
        // mock auth server never checks it, so a dummy value is fine.
        SUPABASE_SECRET_KEY: "sb_secret_test_key_for_e2e",
        // Prisma needs *something*; nothing in the auth flow touches the DB
        // via Prisma, so a fake URL is fine.
        //
        // Inherited when set, because the host isn't always localhost: the CI
        // e2e job runs inside the Playwright container, where the Postgres
        // service is reachable by its service name rather than over the
        // runner's loopback. The literal stays the default so a local
        // `pnpm test:e2e` needs no environment at all.
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://test:test@localhost:5432/halcyon_test",
        DIRECT_URL:
          process.env.DIRECT_URL ??
          "postgresql://test:test@localhost:5432/halcyon_test",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});

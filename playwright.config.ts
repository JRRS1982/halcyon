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
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
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
    ...(isCI
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: "node e2e/_mock/supabase.mjs",
      url: `${mockSupabaseURL}/health`,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm next dev -p ${testAppPort}`,
      url: baseURL,
      reuseExistingServer: !isCI,
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
        DATABASE_URL: "postgresql://test:test@localhost:5432/halcyon_test",
        DIRECT_URL: "postgresql://test:test@localhost:5432/halcyon_test",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});

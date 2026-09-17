import { defineConfig, devices } from "@playwright/test";

// Smoke tests against a *deployed* environment — production, after Vercel has
// promoted it. Separate from playwright.config.ts on purpose: that one starts a
// dev server and a mock Supabase on localhost, neither of which belongs
// anywhere near a real deployment.
//
// SMOKE_BASE_URL is the deployment being checked. The smoke workflow passes the
// target_url from the deployment_status event, so the assertions run against
// the exact build that was promoted.
const baseURL = process.env.SMOKE_BASE_URL ?? "https://www.balanced.money";

export default defineConfig({
  testDir: "./e2e/smoke",
  // One engine. These assert on status codes and redirects, not rendering, so
  // a second browser would re-test the same server three times — the same
  // reasoning that gates the server-action journeys to chromium.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A real deployment, so a single retry absorbs a cold start or a blip
  // without turning a release into a false alarm. The local suite keeps its
  // zero-retry rule; that one is testing code, this one is testing a network.
  retries: 1,
  // No webServer: the thing under test is already running, somewhere else.
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
});

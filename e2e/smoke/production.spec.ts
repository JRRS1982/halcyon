import { expect, test } from "@playwright/test";

// Post-deployment smoke tests. These run against a real, promoted deployment,
// so they are strictly unauthenticated and read-only: no sign-in, no writes,
// no fixtures. Nothing here may leave a trace in the production database.
//
// The bar is not "the app is correct" — the CI suite already answered that
// against this commit. It is "the thing that got promoted is actually serving,
// and can reach its database", which a deployment record cannot tell you.

test.describe("a promoted deployment", () => {
  // Bearer-gated (see src/app/api/health/route.ts), so the probe carries the
  // same CRON_SECRET health.yml uses. Sent as a header rather than stored in
  // the config so it never reaches a trace or a report artifact.
  const authed = { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };

  test("is serving, and can reach the database", async ({ request }) => {
    // The load-bearing check. Middleware redirects unauthenticated page
    // requests before any query runs, so a page 307 proves routing and nothing
    // about the database; this is the one path that actually touches it.
    const response = await request.get("/api/health", { headers: authed });

    // A 401 is a drifted secret, not an outage — September's misdiagnosis in
    // miniature, so the message says which it is rather than leaving someone
    // to read "production is down".
    expect(
      response.status(),
      response.status() === 401
        ? "401 from /api/health — the CRON_SECRET repo secret does not match Vercel's"
        : "health probe did not return 200",
    ).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("keeps its health detail to itself", async ({ request }) => {
    // The body must stay a verdict, never diagnostics — this is what stops a
    // later "helpful" error message naming the host, port or role.
    const body = await (
      await request.get("/api/health", { headers: authed })
    ).text();
    expect(body).not.toMatch(/postgres|supabase|password|5432|6543/i);
  });

  const AUTHED_ROUTES = [
    "/budget",
    "/balance",
    "/plan",
    "/dashboard",
    "/transactions",
    "/settings",
  ];

  for (const route of AUTHED_ROUTES) {
    test(`redirects ${route} to sign-in instead of erroring`, async ({
      request,
    }) => {
      // A 500 here is the schema/code split that broke /plan in Aug 2026 and
      // /budget in Sep 2026: the deployment is live, but its code and its
      // database disagree. The redirect is what healthy looks like.
      const response = await request.get(route, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      expect(response.headers().location).toContain("/sign-in");
    });
  }

  const PUBLIC_PAGES = ["/", "/sign-in", "/sign-up", "/privacy", "/terms"];

  for (const page of PUBLIC_PAGES) {
    test(`serves ${page}`, async ({ request }) => {
      const response = await request.get(page);
      expect(response.status()).toBe(200);
      // A 200 alone is not proof: Vercel's Deployment Protection interstitial
      // is also a 200. The first real run passed these while testing a login
      // wall. Require the app's own title so a stranger's page cannot pass.
      expect(await response.text()).toContain("<title>Balanced Money");
    });
  }
});

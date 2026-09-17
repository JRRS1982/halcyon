import { expect, test } from "@playwright/test";

// Post-deployment smoke tests. These run against a real, promoted deployment,
// so they are strictly unauthenticated and read-only: no sign-in, no writes,
// no fixtures. Nothing here may leave a trace in the production database.
//
// The bar is not "the app is correct" — the CI suite already answered that
// against this commit. It is "the thing that got promoted is actually serving,
// and can reach its database", which a deployment record cannot tell you.

test.describe("a promoted deployment", () => {
  test("is serving, and can reach the database", async ({ request }) => {
    // The load-bearing check. Middleware redirects unauthenticated page
    // requests before any query runs, so a page 307 proves routing and nothing
    // about the database; this is the one unauthenticated path that touches it.
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      db: "ok",
    });
  });

  test("keeps its health detail to itself", async ({ request }) => {
    // Public endpoint: the body must stay a verdict, never diagnostics.
    const body = await (await request.get("/api/health")).text();
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
      expect((await request.get(page)).status()).toBe(200);
    });
  }
});

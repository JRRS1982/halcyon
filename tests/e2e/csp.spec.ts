// tests/e2e/csp.spec.ts
//
// The report-only Content-Security-Policy against the app's own pages.
//
// Before the policy is enforced it must not object to anything the app itself
// does — an objection here would be a page that breaks the day it is switched
// on. Browsers raise a `securitypolicyviolation` event for report-only
// violations too, so each page is loaded with a listener collecting them.
//
// Not gated to chromium: each engine evaluates CSP itself, and a webkit-only
// objection is exactly what this exists to catch.
import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./_helpers/fixtures";

// Where the init script collects violations on the page's window.
declare global {
  interface Window {
    __csp?: string[];
  }
}

const collectViolations = (page: Page) =>
  page.addInitScript(() => {
    const seen: string[] = [];
    window.__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.effectiveDirective} ← ${event.blockedURI}`);
    });
  });

const violationsOn = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForLoadState("load");
  return page.evaluate(() => window.__csp ?? []);
};

test.describe("content security policy (report-only)", () => {
  test("is sent alongside the enforced framing rule", async ({ request }) => {
    const headers = (await request.get("/")).headers();

    expect(headers["content-security-policy-report-only"]).toContain(
      "report-uri /api/csp-report",
    );
    expect(headers["reporting-endpoints"]).toBe('csp="/api/csp-report"');
  });

  test("has nothing to report on the public pages", async ({ page }) => {
    await collectViolations(page);

    for (const path of ["/", "/guide", "/sign-in", "/privacy", "/design"]) {
      expect(await violationsOn(page, path), path).toEqual([]);
    }
  });

  test("has nothing to report on the signed-in pages", async ({ page }) => {
    await collectViolations(page);
    await signIn(page);

    for (const path of [
      "/transactions",
      "/budget",
      "/balance",
      "/dashboard",
      "/plan",
      "/settings",
    ]) {
      expect(await violationsOn(page, path), path).toEqual([]);
    }
  });
});

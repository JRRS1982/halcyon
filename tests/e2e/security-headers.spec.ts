// tests/e2e/security-headers.spec.ts
//
// The browser protections next.config.mjs asks for. They are configuration,
// so the only proof they ship is a real response carrying them: a typo in a
// header name fails silently and the page renders exactly the same.
import { expect, test } from "@playwright/test";

const EXPECTED = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

// A public page, a signed-out auth page carrying a token in its URL, and a
// protected path that answers with a redirect — the headers apply to all.
for (const path of ["/", "/reset-password?token_hash=x", "/settings"]) {
  test(`${path} is sent with the security headers`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.headers()).toMatchObject(EXPECTED);
  });
}

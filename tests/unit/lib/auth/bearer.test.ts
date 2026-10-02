/** @jest-environment node */
import { isAuthorizedBearer } from "@/lib/auth/bearer";

const request = (authorization?: string) =>
  new Request("https://example.test/x", {
    headers: authorization ? { authorization } : {},
  });

describe("isAuthorizedBearer", () => {
  test("accepts the exact bearer", () => {
    expect(isAuthorizedBearer(request("Bearer s3cret"), "s3cret")).toBe(true);
  });

  test("rejects a wrong secret, a missing header and the wrong scheme", () => {
    expect(isAuthorizedBearer(request("Bearer nope"), "s3cret")).toBe(false);
    expect(isAuthorizedBearer(request(), "s3cret")).toBe(false);
    expect(isAuthorizedBearer(request("Basic s3cret"), "s3cret")).toBe(false);
  });

  // A prefix or a longer value must not pass — the length check is a
  // short-circuit, not a loophole. (Not tested with trailing whitespace: the
  // Fetch Headers spec trims header values, so the function never sees it.)
  test("rejects near-misses of a different length", () => {
    expect(isAuthorizedBearer(request("Bearer s3cre"), "s3cret")).toBe(false);
    expect(isAuthorizedBearer(request("Bearer s3cretX"), "s3cret")).toBe(false);
  });

  // "No secret configured" must never read as "no authentication required".
  test("refuses everything when the secret is unset", () => {
    expect(isAuthorizedBearer(request("Bearer "), undefined)).toBe(false);
    expect(isAuthorizedBearer(request("Bearer x"), "")).toBe(false);
    expect(isAuthorizedBearer(request(), undefined)).toBe(false);
  });
});

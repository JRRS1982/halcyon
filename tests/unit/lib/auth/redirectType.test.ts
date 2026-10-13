import { isRecoveryExchange } from "@/lib/auth/redirectType";

// auth-js returns `redirectType` from exchangeCodeForSession — its own JSDoc
// example response shows `redirectType: null` — but the declared return type
// (AuthTokenResponse) does not carry the field. Reading it therefore has to be
// a runtime check rather than a cast: if a future release drops it, this
// returns false and the callback keeps working rather than throwing.
describe("isRecoveryExchange", () => {
  it("recognises a recovery flow", () => {
    expect(isRecoveryExchange({ redirectType: "recovery" })).toBe(true);
  });

  it("treats every other flow as ordinary sign-in", () => {
    expect(isRecoveryExchange({ redirectType: null })).toBe(false);
    expect(isRecoveryExchange({ redirectType: "signup" })).toBe(false);
  });

  // The field is absent from the declared type, so it may be absent at runtime
  // too — on an older or newer release, or on an error result.
  it("says no when the field is missing or the shape is not an object", () => {
    expect(isRecoveryExchange({})).toBe(false);
    expect(isRecoveryExchange(null)).toBe(false);
    expect(isRecoveryExchange(undefined)).toBe(false);
    expect(isRecoveryExchange("recovery")).toBe(false);
  });
});

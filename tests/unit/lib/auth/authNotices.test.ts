import { AUTH_NOTICES, authNotice } from "@/lib/auth/authNotices";

describe("authNotice", () => {
  it("renders the message for a code the app produces", () => {
    expect(authNotice("sign-in-failed")).toBe(
      "Email or password is incorrect.",
    );
  });

  // The reason the table exists: `?error=` used to be rendered verbatim, so a
  // hand-written link could put an attacker's words above the real sign-in
  // form on the real domain. Anything the app did not produce has no message.
  it("renders nothing for text it did not produce", () => {
    expect(
      authNotice(
        "Your account was locked. Call 0800-555-0100 to restore access.",
      ),
    ).toBeUndefined();
    expect(authNotice("not-a-code")).toBeUndefined();
    expect(authNotice("")).toBeUndefined();
    expect(authNotice(undefined)).toBeUndefined();
  });

  // Prototype keys are the classic way past a plain-object lookup.
  it("renders nothing for inherited object properties", () => {
    expect(authNotice("toString")).toBeUndefined();
    expect(authNotice("constructor")).toBeUndefined();
    expect(authNotice("__proto__")).toBeUndefined();
  });

  it("gives every code a non-empty message", () => {
    for (const [code, message] of Object.entries(AUTH_NOTICES)) {
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
      expect(code).toMatch(/^[a-z-]+$/);
    }
  });
});

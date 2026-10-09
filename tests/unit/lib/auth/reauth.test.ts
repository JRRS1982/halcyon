import { reauthMethodFor } from "@/lib/auth/reauth";

describe("reauthMethodFor", () => {
  it("asks for a password when the account has an email identity", () => {
    expect(reauthMethodFor([{ provider: "email" }])).toBe("password");
  });

  it("asks for a code when the account is Google-only", () => {
    expect(reauthMethodFor([{ provider: "google" }])).toBe("otp");
  });

  // Identity linking: a Google user who later set a password holds both, and
  // has a password to type, so the password control is the right one.
  it("prefers the password when both identities are linked", () => {
    expect(
      reauthMethodFor([{ provider: "google" }, { provider: "email" }]),
    ).toBe("password");
  });

  // getUser() does not always populate identities. A code works for any
  // confirmed account; a password box for someone with no password is the bug
  // this feature exists to fix, so absence falls to otp.
  it("falls back to a code when identities are missing or empty", () => {
    expect(reauthMethodFor(undefined)).toBe("otp");
    expect(reauthMethodFor(null)).toBe("otp");
    expect(reauthMethodFor([])).toBe("otp");
  });
});

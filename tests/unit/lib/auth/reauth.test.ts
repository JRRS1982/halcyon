import { reauthMethodFor, reauthSchema } from "@/lib/auth/reauth";

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

  // An account always signed up as one thing or the other, so this is a fact
  // to read, never a guess. GoTrue refuses to unlink a user's last identity
  // ("User must have at least 1 identity after unlinking") and this app has no
  // anonymous sign-in, so an empty list is a broken read rather than a user
  // state — and the one thing that must not happen is defaulting to the weaker
  // gate, which would hand a password account's confirmation to whoever can
  // read its inbox.
  it("refuses to classify an account with no identities", () => {
    expect(reauthMethodFor(undefined)).toBeNull();
    expect(reauthMethodFor(null)).toBeNull();
    expect(reauthMethodFor([])).toBeNull();
  });
});

// The proof arrives from the browser at a server action and decides which
// credential gate runs. The union that types it is erased at runtime, so
// without this nothing checks its shape before it reaches the auth client.
describe("reauthSchema", () => {
  it("accepts the two shapes the panels send", () => {
    expect(
      reauthSchema.safeParse({ method: "password", password: "hunter2" })
        .success,
    ).toBe(true);
    expect(
      reauthSchema.safeParse({ method: "otp", code: "123456" }).success,
    ).toBe(true);
  });

  it("refuses a non-string standing in for a password", () => {
    expect(
      reauthSchema.safeParse({ method: "password", password: { $ne: null } })
        .success,
    ).toBe(false);
    expect(
      reauthSchema.safeParse({ method: "password", password: "" }).success,
    ).toBe(false);
  });

  it("refuses a code that is not six digits", () => {
    expect(
      reauthSchema.safeParse({ method: "otp", code: ["000000"] }).success,
    ).toBe(false);
    expect(
      reauthSchema.safeParse({ method: "otp", code: "12345" }).success,
    ).toBe(false);
    expect(
      reauthSchema.safeParse({ method: "otp", code: "abcdef" }).success,
    ).toBe(false);
  });

  it("refuses a method the app does not have", () => {
    expect(
      reauthSchema.safeParse({ method: "magic", token: "x" }).success,
    ).toBe(false);
  });
});

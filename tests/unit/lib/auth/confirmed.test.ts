import { isEmailConfirmed } from "@/lib/auth/confirmed";

// If this is wrong and the Supabase "Confirm email" toggle is ever off, someone
// signs up as an address they do not own and uses the whole app as its owner.
describe("isEmailConfirmed", () => {
  it("accepts a confirmed account", () => {
    expect(
      isEmailConfirmed({ email_confirmed_at: "2026-10-12T00:00:00Z" }),
    ).toBe(true);
  });

  it("refuses an unconfirmed one", () => {
    expect(isEmailConfirmed({ email_confirmed_at: undefined })).toBe(false);
  });

  // Fails closed on a field Supabase did not send, rather than assuming the
  // best about a response shape we do not control.
  it("refuses when the field is absent", () => {
    expect(isEmailConfirmed({} as { email_confirmed_at: undefined })).toBe(
      false,
    );
  });
});

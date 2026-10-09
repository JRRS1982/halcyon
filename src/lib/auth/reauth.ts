// How an account proves who it is before a destructive action.
//
// Supabase accounts carry one identity per sign-in method (email, phone,
// oauth, saml) and may hold several at once. Only an `email` identity implies
// a password, so everything else — a Google-only account above all, or an
// account whose identities did not come back — proves itself with a one-time
// code emailed to the address on the account instead.
export type ReauthMethod = "password" | "otp";

export type Reauthentication =
  | { method: "password"; password: string }
  | { method: "otp"; code: string };

export const reauthMethodFor = (
  identities: readonly { provider: string }[] | null | undefined,
): ReauthMethod =>
  identities?.some((identity) => identity.provider === "email")
    ? "password"
    : "otp";

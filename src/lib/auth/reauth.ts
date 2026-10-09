// How an account proves who it is before a destructive action.
//
// Supabase accounts carry one identity per sign-in method (email, phone,
// oauth, saml) and may hold several at once. Only an `email` identity implies
// a password; a Google-only account proves itself with a one-time code emailed
// to the address on the account instead.
//
// This is a fact to read, never a guess. An account signed up as one thing or
// the other and that is recorded; GoTrue refuses to unlink a user's last
// identity ("User must have at least 1 identity after unlinking"), and this app
// has no anonymous sign-in, so every signed-in account carries at least one.
// An empty list is therefore a broken read, not a user state — hence `null`
// rather than a default. Defaulting to the code would silently hand a password
// account's gate to whoever can read its inbox, which is the exact downgrade
// the server-side check in dataActions.ts exists to refuse.
export type ReauthMethod = "password" | "otp";

export type Reauthentication =
  | { method: "password"; password: string }
  | { method: "otp"; code: string };

export const reauthMethodFor = (
  identities: readonly { provider: string }[] | null | undefined,
): ReauthMethod | null => {
  if (!identities?.length) return null;
  return identities.some((identity) => identity.provider === "email")
    ? "password"
    : "otp";
};

// What a password change can say, and the words for each.
//
// A code and a shared table, not a thrown message, because a thrown message
// does not survive the trip. Next serialises a server action's error as
// `{ digest }` alone in a production build — the development build sends
// `name`, `message` and `stack`, which is why reading `err.message` on the
// client looks fine locally and shows the generic fallback in production.
//
// A returned value has no such treatment, so the refusal travels as data. The
// panel renders CHANGE_PASSWORD_MESSAGES[reason], so there is one list rather
// than an allowlist on each side that can silently drift apart.
export const CHANGE_PASSWORD_MESSAGES = {
  "current-password-required": "Enter your current password.",
  "too-short": "Your new password must be at least 12 characters.",
  "too-long": "Your new password must be at most 200 characters.",
  "same-password":
    "That's the password you already have. Choose a different one.",
  "wrong-password": "That isn't your current password.",
  "wrong-method":
    "That isn't how this account signs in. Reload the page and try again.",
  "rate-limited": "Too many attempts. Please try again later.",
  breached:
    "That password has appeared in a data breach. Please choose another.",
  "provider-refused": "Couldn't change your password. Please try again.",
} as const;

export type ChangePasswordRefusal = keyof typeof CHANGE_PASSWORD_MESSAGES;

export type ChangePasswordOutcome =
  // `othersSignedOut` is false when the password changed but revoking the
  // other sessions did not — true for the caller to report, not to hide.
  | { ok: true; othersSignedOut: boolean }
  | { ok: false; reason: ChangePasswordRefusal };

// What a re-authenticated action can refuse with, and the words for each.
//
// The same reasoning as changePasswordOutcome.ts, for the four destructive
// data actions and the code-send beside them: a server action's thrown error
// reaches the browser as a bare digest in a production build, so a panel
// reading `err.message` shows one generic line whatever went wrong. The
// refusal travels as a code instead, and this table is the only place its
// words live.
export const REAUTH_MESSAGES = {
  "wrong-password": "Incorrect password.",
  "wrong-method":
    "That isn't how this account signs in. Reload the page and try again.",
  "bad-code": "That code is not valid. Check it and try again.",
  "rate-limited": "Too many attempts. Please try again later.",
  "export-rate-limited": "Too many export requests. Please try again later.",
  "code-send-limited": "Too many codes requested. Please try again later.",
  "code-send-failed": "Couldn't send a code. Please try again.",
  // Nothing the user did. Reaching this means an unmapped throw, so it says
  // the true thing rather than naming a rule they did not break.
  failed: "Something went wrong. Please try again.",
} as const;

export type ReauthRefusal = keyof typeof REAUTH_MESSAGES;

export type Refused = { ok: false; reason: ReauthRefusal };

// `ok` carries whatever the action produces, which for three of the five is
// nothing at all.
export type ReauthOutcome<T = unknown> = ({ ok: true } & T) | Refused;

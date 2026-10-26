// Every message the auth pages are willing to show, keyed by a code.
//
// `?error=` was rendered verbatim into the Alert above the sign-in form, so
// anything in the URL became the app's own voice: a hand-written link could
// put "Your account was locked — call 0800…" on the real domain, over TLS,
// above the real form, with every trust signal the user checks agreeing.
// React escapes markup, so this was never XSS — it is the page saying what an
// attacker chose, which for a phishing page is the useful half.
//
// The same files already did this correctly for `?timeout=`, with a comment
// saying an arbitrary value must render nothing rather than be echoed. This is
// that rule applied to the parameter that needed it more, and the reason the
// producers send a code: a message that is never carried in the URL cannot be
// substituted in the URL.
export const AUTH_NOTICES = {
  "invalid-email": "Enter a valid email address.",
  "password-required": "Password is required.",
  "password-too-short": "Password must be at least 12 characters.",
  "password-breached":
    "That password has appeared in a data breach. Please choose another.",
  "invalid-form": "Check the form and try again.",
  "too-many-attempts": "Too many attempts. Please wait a minute and try again.",
  "signup-unavailable":
    "Sign-up is temporarily unavailable. Please try again shortly.",
  // Deliberately the same answer for an unknown address and a wrong password.
  // The provider distinguishes them and the log records which; the page must
  // not, or a list of addresses becomes a list of accounts.
  "sign-in-failed": "Email or password is incorrect.",
  "missing-code": "That sign-in link is incomplete. Please try again.",
  "link-expired": "That link has expired or has already been used.",
  // A password-reset code reaching the callback rather than /reset-password,
  // which means a link from before the reset template pointed there. It is
  // still not a login, and the honest answer is to say so.
  "link-unusable": "That link can't be used to sign in.",
  "reset-unavailable":
    "Password reset is temporarily unavailable. Please try again shortly.",
  "reset-link-invalid":
    "That reset link has expired or has already been used. Request a new one.",
  // Only ever shown after the link has been verified, so it reaches someone
  // who controls the inbox — never a stranger typing addresses into a form.
  "reset-google-account":
    "This account signs in with Google, so it has no password to reset. Use Continue with Google.",
  "reset-same-password":
    "That is already your password. Sign in with it, or request a new link to choose a different one.",
  "reset-failed":
    "We couldn't set that password. Request a new link and try again.",
  "provider-declined": "Google sign-in was not completed. Please try again.",
  "oauth-unavailable": "Could not start Google sign-in.",
} as const;

export type AuthNoticeCode = keyof typeof AUTH_NOTICES;

// Object.hasOwn, not a plain index: `?error=toString` would otherwise find the
// inherited function and render it, which is the lookup table leaking exactly
// the thing it was built to stop.
const isAuthNoticeCode = (code: string): code is AuthNoticeCode =>
  Object.hasOwn(AUTH_NOTICES, code);

// Unknown codes render nothing at all, which is the whole point: a value the
// app did not produce has no message.
export const authNotice = (code: string | undefined): string | undefined =>
  code !== undefined && isAuthNoticeCode(code) ? AUTH_NOTICES[code] : undefined;

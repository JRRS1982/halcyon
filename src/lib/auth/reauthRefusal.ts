import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { ReauthRefusal } from "@/lib/auth/reauthOutcome";
import { REAUTH_ERRORS } from "@/lib/auth/verifyUser";

// verifyUser and sendReauthCode throw, because throwing is what a gate should
// do. Turning that into a code is the caller's job, and it happens here so the
// five callers agree rather than each matching strings of their own.
const BY_MESSAGE: Record<string, ReauthRefusal> = {
  [REAUTH_ERRORS.wrongPassword]: "wrong-password",
  [REAUTH_ERRORS.wrongMethod]: "wrong-method",
  [REAUTH_ERRORS.badCode]: "bad-code",
  [REAUTH_ERRORS.rateLimited]: "rate-limited",
  [REAUTH_ERRORS.exportRateLimited]: "export-rate-limited",
  [REAUTH_ERRORS.codeSendLimited]: "code-send-limited",
  [REAUTH_ERRORS.codeSendFailed]: "code-send-failed",
};

/**
 * The code for a refusal thrown by the re-auth gate.
 *
 * Rethrows anything the framework owns first: redirect() and notFound() work
 * by throwing, and reauthAccount sends an unclassifiable account back to
 * sign-in. Catching that navigation and calling it a refusal would leave the
 * user on a panel that answers "something went wrong" and never moves.
 *
 * An unmapped throw is a bug rather than a rule the user broke, so it reads as
 * "something went wrong" instead of naming a rule they did not break.
 */
export const refusalFor = (err: unknown): ReauthRefusal => {
  unstable_rethrow(err);
  const message = err instanceof Error ? err.message : "";
  return BY_MESSAGE[message] ?? "failed";
};

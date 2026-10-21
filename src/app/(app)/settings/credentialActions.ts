"use server";

import { unstable_rethrow } from "next/navigation";
import { checkPasswordBreach } from "@/lib/auth/breachedPassword";
import type {
  ChangePasswordOutcome,
  ChangePasswordRefusal,
} from "@/lib/auth/changePasswordOutcome";
import { requireUserId } from "@/lib/auth/requireUserId";
import {
  type ChangePasswordInput,
  changePasswordSchema,
} from "@/lib/auth/schemas";
import { REAUTH_ERRORS, verifyUser } from "@/lib/auth/verifyUser";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// Which rule the schema refused. The message is the schema's, so this maps it
// back to a code rather than sending the text: see changePasswordOutcome.ts
// for why a thrown message cannot reach the browser in production.
const REFUSAL_BY_MESSAGE: Record<string, ChangePasswordRefusal> = {
  "Enter your current password": "current-password-required",
  "Password must be at least 12 characters": "too-short",
  "Password must be at most 200 characters": "too-long",
  "Choose a password you aren't already using": "same-password",
  [REAUTH_ERRORS.wrongPassword]: "wrong-password",
  [REAUTH_ERRORS.wrongMethod]: "wrong-method",
  [REAUTH_ERRORS.rateLimited]: "rate-limited",
};

const refusalFor = (err: unknown): ChangePasswordRefusal => {
  // redirect() and notFound() work by throwing; without this they would be
  // caught here and reported as a refusal, leaving the user on a stuck form.
  unstable_rethrow(err);
  const message = err instanceof Error ? err.message : "";
  const reason = REFUSAL_BY_MESSAGE[message];
  if (!reason) log.warn("Unmapped error in changePassword", { message });
  // An unmapped throw is a bug, not a rule the user broke, so it reads as the
  // provider refusing rather than inventing a reason they could act on.
  return reason ?? "provider-refused";
};

// Changes the password of an account that signs in with one.
//
// Returns its refusals rather than throwing them. A server action's thrown
// error reaches the browser as a bare digest in a production build, so a
// panel reading `err.message` would show the same generic line for a wrong
// password, a breached one and a rate limit alike.
//
// No rate-limit bucket of its own. The only guessable part of this is the
// current password, and verifyUser already spends `verify-password` and
// `verify-password-account` on it; a successful change is cheap and its own
// brake, since the next attempt needs the password this one just set.
export async function changePassword(
  input: ChangePasswordInput,
): Promise<ChangePasswordOutcome> {
  const userId = await requireUserId("/settings");

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: refusalFor(new Error(parsed.error.issues[0]?.message ?? "")),
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  // Proves the account holder, not merely a live session — an unlocked browser
  // should not be able to lock its owner out of their own account. This also
  // refuses an account that signs in with Google: verifyUser derives the
  // method from the account's identities and assertMethod rejects the
  // mismatch, so the panel being hidden for those accounts is the courtesy,
  // not the fence.
  //
  // It signs in as a side effect, which leaves the session fresh enough for
  // GoTrue's secure-password-change recency window.
  //
  // It throws, because its four other callers want that; here the refusal is
  // part of the answer, so it becomes one.
  try {
    await verifyUser({ method: "password", password: currentPassword });
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
  }

  // The same check sign-up makes, for the same reason and with the same
  // policy: a breached password is the one credential-stuffing actually uses,
  // and "unknown" means HIBP was unreachable, which is not the user's fault.
  // Without this the floor could be walked around from the inside — sign up
  // with something strong, then change it to one of the top thousand.
  const breach = await checkPasswordBreach(newPassword);
  if (breach === "breached") return { ok: false, reason: "breached" };
  if (breach === "unknown") {
    log.warn("Breached-password check unavailable; allowing password change", {
      userId,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // Supabase enforces its own minimum and its own reuse rules, so this is
    // reachable with a password this app accepted. The user gets something
    // readable; the log gets which rule it was, and whose.
    log.error("Password change rejected", { userId, err: error });
    return { ok: false, reason: "provider-refused" };
  }

  // The reason to change a password is usually that someone else may have
  // access. Every other session is revoked, so the change evicts them instead
  // of leaving them signed in with a password that no longer works; `others`
  // keeps this browser signed in, so the user is not thrown out of the page
  // they just used.
  //
  // Wrapped, because a network failure here throws rather than returning an
  // error — and the password has already changed by this point, so letting it
  // escape would report a failure that did not happen.
  const revoked = await supabase.auth
    .signOut({ scope: "others" })
    .then(({ error: revokeError }) => !revokeError)
    .catch(() => false);

  if (!revoked) {
    // Not a refusal: the password did change, and saying otherwise would
    // invite a second attempt that revokes nothing either. But it is not
    // nothing — a session elsewhere has outlived the password it was created
    // with, which is the one thing someone changing their password wants gone.
    // So it is logged, and reported back, rather than papered over by a
    // confirmation that claims every device was signed out.
    log.error("Password changed but other sessions were not revoked", {
      userId,
    });
  }

  return { ok: true, othersSignedOut: revoked };
}

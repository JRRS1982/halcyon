"use server";

import { checkPasswordBreach } from "@/lib/auth/breachedPassword";
import { requireUserId } from "@/lib/auth/requireUserId";
import {
  type ChangePasswordInput,
  changePasswordSchema,
} from "@/lib/auth/schemas";
import { verifyUser } from "@/lib/auth/verifyUser";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// Changes the password of an account that signs in with one.
//
// No rate-limit bucket of its own. The only guessable part of this is the
// current password, and verifyUser already spends `verify-password` and
// `verify-password-account` on it; a successful change is cheap and its own
// brake, since the next attempt needs the password this one just set.
export async function changePassword(
  input: ChangePasswordInput,
): Promise<{ othersSignedOut: boolean }> {
  await requireUserId("/settings");
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    // The schema's own message, which the panel renders from its allowlist.
    // These are strings this app authored, not anything the caller supplied,
    // so passing one back says which rule failed without echoing input.
    throw new Error(
      parsed.error.issues[0]?.message ?? "Check the form and try again",
    );
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
  await verifyUser({ method: "password", password: currentPassword });

  // The same check sign-up makes, for the same reason and with the same
  // policy: a breached password is the one credential-stuffing actually uses,
  // and "unknown" means HIBP was unreachable, which is not the user's fault.
  // Without this the floor could be walked around from the inside — sign up
  // with something strong, then change it to one of the top thousand.
  const breach = await checkPasswordBreach(newPassword);
  if (breach === "breached") {
    throw new Error("That password has appeared in a data breach");
  }
  if (breach === "unknown") {
    log.warn("Breached-password check unavailable; allowing password change");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // Supabase enforces its own minimum and its own reuse rules, so this is
    // reachable with a password this app accepted. The user gets something
    // readable; the log gets which rule it was.
    log.error("Password change rejected", { err: error });
    throw new Error("Couldn't change your password. Please try again.");
  }

  // The reason to change a password is usually that someone else may have
  // access. Every other session is revoked, so the change evicts them instead
  // of leaving them signed in with a password that no longer works; `others`
  // keeps this browser signed in, so the user is not thrown out of the page
  // they just used.
  const { error: revokeError } = await supabase.auth.signOut({
    scope: "others",
  });
  if (revokeError) {
    // Not an error to throw: the password did change, and saying otherwise
    // would invite a second attempt that revokes nothing either. But it is not
    // nothing — a session elsewhere has outlived the password it was created
    // with, which is the one thing someone changing their password wants gone.
    // So it is logged, and reported back, rather than papered over by a
    // confirmation that claims every device was signed out.
    log.error("Password changed but other sessions were not revoked", {
      err: revokeError,
    });
  }

  return { othersSignedOut: !revokeError };
}

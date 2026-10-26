"use server";

import { redirect } from "next/navigation";
import { startActivityClock } from "@/lib/auth/activityClock";
import type { AuthNoticeCode } from "@/lib/auth/authNotices";
import { checkPasswordBreach } from "@/lib/auth/breachedPassword";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { reauthMethodFor } from "@/lib/auth/reauth";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// Back to the form with the link still attached, for a refusal that happened
// before the link was spent: the user fixes the password and submits again.
function retryWith(tokenHash: string, code: AuthNoticeCode): never {
  const params = new URLSearchParams({ token_hash: tokenHash, error: code });
  redirect(`/reset-password?${params}`);
}

// Sets a new password from a reset link.
//
// The link is spent here, on submit, and never on page load. Mail scanners
// (Outlook Safe Links and the like) open every link in an email; a page that
// verified on GET would burn the one-time token before the user ever saw it.
//
// Everything that can refuse without the provider — shape, length, breach —
// runs before the token is verified, because after that the link is used up
// and a refusal means asking for a new email.
export const resetPassword = async (formData: FormData) => {
  const rawTokenHash = formData.get("tokenHash");
  const parsed = resetPasswordSchema.safeParse({
    tokenHash: rawTokenHash,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    if (typeof rawTokenHash !== "string" || rawTokenHash === "") {
      redirect("/forgot-password?error=reset-link-invalid");
    }
    retryWith(
      rawTokenHash,
      parsed.error.issues[0]?.path[0] === "tokenHash"
        ? "reset-link-invalid"
        : "password-too-short",
    );
  }
  const { tokenHash, password } = parsed.data;

  if (
    (await checkRateLimit("reset-password", await clientIp())) !== "allowed"
  ) {
    retryWith(tokenHash, "too-many-attempts");
  }

  // Same check and same policy as sign-up and the Settings change: "unknown"
  // means HIBP was unreachable, which is not a reason to refuse.
  const breach = await checkPasswordBreach(password);
  if (breach === "breached") retryWith(tokenHash, "password-breached");
  if (breach === "unknown") {
    log.warn("Breached-password check unavailable; allowing password reset");
  }

  const supabase = await createClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (verifyError || !data.user) {
    log.warn("Password reset link rejected", { err: verifyError ?? undefined });
    redirect("/forgot-password?error=reset-link-invalid");
  }

  // Verifying the link signed this browser in. From here on every refusal
  // must end that session, or a refused reset is still a login.
  const refuse = async (code: AuthNoticeCode): Promise<never> => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    redirect(`/sign-in?error=${code}`);
  };

  // An account that signs in with Google has no password, and a reset must
  // not quietly give it one: a second way in changes what the step-up check
  // in Settings asks for (see reauth.ts). Only reachable by someone who can
  // read the inbox, so saying which kind of account it is leaks nothing.
  if (reauthMethodFor(data.user.identities) !== "password") {
    return refuse("reset-google-account");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    log.error("Password reset rejected by provider", {
      userId: data.user.id,
      err: updateError,
    });
    return refuse(
      updateError.code === "same_password"
        ? "reset-same-password"
        : "reset-failed",
    );
  }

  // A reset usually means someone else may have the old password. Ending
  // every other session evicts them; `others` keeps this one. Best-effort,
  // because the password has already changed and the user must not be told
  // otherwise — the failure is logged instead.
  const revoked = await supabase.auth
    .signOut({ scope: "others" })
    .then(({ error }) => !error)
    .catch(() => false);
  if (!revoked) {
    log.error("Password reset but other sessions were not revoked", {
      userId: data.user.id,
    });
  }

  // The proxy reads a session with no activity cookie as expired.
  await startActivityClock();
  redirect(POST_AUTH_LANDING);
};

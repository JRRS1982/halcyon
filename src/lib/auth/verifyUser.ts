import "server-only";

import { redirect } from "next/navigation";
import {
  type Reauthentication,
  type ReauthMethod,
  reauthMethodFor,
} from "@/lib/auth/reauth";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

// Step-up re-authentication, shared by every Settings action that needs the
// account holder rather than just a live session: the data actions in
// dataActions.ts and the credential changes in credentialActions.ts.
//
// A plain server-only module, not a "use server" file. Every export of one of
// those is a server action the browser can call directly, and verifyUser on
// its own would be a password oracle with nothing behind it.

// The account this request is re-authenticating, and the proof it may offer.
//
// Shared by both entry points rather than hoisted above them: `verifyUser` and
// `sendReauthCode` are independently reachable server actions, so each has to
// assert for itself — a wrapper they must remember to call would be the weaker
// design. What they share is the lookup and the two things that can go wrong
// with it.
//
// `getCurrentUser` is request-memoised, so the second call in a destructive
// action (requireUserId, then this) costs nothing.
export async function reauthAccount(): Promise<{
  email: string;
  method: ReauthMethod;
}> {
  const user = await getCurrentUser();
  // An account with no address can neither be mailed a code nor matched to a
  // password; treat it as unauthenticated rather than failing obscurely.
  if (!user?.email) redirect("/sign-in?next=/settings");

  // Unclassifiable, which should not happen: every signed-in account carries an
  // identity (see reauth.ts). Fail closed and say so in the log rather than
  // picking a gate — picking the weaker one is the downgrade this whole check
  // exists to refuse, and picking the stronger one locks a Google account out
  // of erasing its own data. A fresh sign-in is the honest recovery.
  const method = reauthMethodFor(user.identities);
  if (!method) {
    log.error("Re-auth method unreadable: account has no identities", {
      userId: user.id,
    });
    redirect("/sign-in?next=/settings");
  }
  return { email: user.email, method };
}

// The browser picks which control to render; it does not get to pick the gate.
// `proof.method` arrives from the client, so without this an attacker holding a
// stolen session on a password account could ask for a code and swap the gate
// from "knows the password" to "can read the inbox" — and with no
// password-reset flow in this app, those two are not equivalent.
//
// Its own message, not "Incorrect password": this is the one event the
// re-derivation exists to catch, and sharing a string with an ordinary typo
// would make it both unloggable and — on the send path, where no password was
// ever typed — nonsense to read.
export function assertMethod(
  actual: ReauthMethod,
  expected: ReauthMethod,
): void {
  if (actual === expected) return;
  log.warn("Re-auth method mismatch", { expected, actual });
  throw new Error("That isn't how this account signs in");
}

// Proves the caller is the account holder before an irreversible action.
//
// Which proof applies depends on how the account signs in: an account with an
// email identity has a password, and everything else — a Google-only account
// above all — has a one-time code mailed to the address on the account. The
// callers do not care which; they hand over whatever the panel collected.
//
// Both branches mint a fresh session as a side effect of verifying, which is
// how Supabase's verification calls work; it refreshes the caller's own
// session and is harmless.
export async function verifyUser(proof: Reauthentication): Promise<void> {
  const { email, method } = await reauthAccount();
  assertMethod(proof.method, method);

  // Only the buckets the chosen gate actually spends. Before, both password
  // buckets were charged whichever proof was offered, so a code attempt ate
  // the password-guessing budget and `verify-code` counted the very same
  // events a second time.
  const verdicts = await Promise.all(
    proof.method === "password"
      ? // Two mirror the sign-in pattern: per-IP bounds one attacker,
        // per-account bounds a pool of IPs guessing at the same user.
        [
          checkRateLimit("verify-password", await clientIp()),
          checkRateLimit("verify-password-account", email),
        ]
      : // One, keyed per account and fail-closed: see the policy comment in
        // rateLimit. A per-IP bound adds little when the subject is the code.
        [checkRateLimit("verify-code", email)],
  );
  if (verdicts.some((verdict) => verdict !== "allowed")) {
    throw new Error("Too many attempts. Please try again later.");
  }

  const supabase = await createClient();

  if (proof.method === "password") {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: proof.password,
    });
    if (error) throw new Error("Incorrect password");
    return;
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: proof.code,
    type: "email",
  });
  if (error) {
    // Kept server-side: the user gets a readable message, the log gets the
    // reason. Without this, a project with email OTP switched off in the
    // Supabase dashboard would fail every Google account forever with nothing
    // anywhere to say why.
    log.error("Re-auth code rejected", { err: error });
    throw new Error("That code is not valid");
  }
}

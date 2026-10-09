"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type Reauthentication,
  type ReauthMethod,
  reauthMethodFor,
} from "@/lib/auth/reauth";
import { serializeExport } from "@/lib/data/serialize";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { seedStarterData } from "@/lib/settings/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

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
async function reauthAccount(): Promise<{
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
function assertMethod(actual: ReauthMethod, expected: ReauthMethod): void {
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
async function verifyUser(proof: Reauthentication): Promise<void> {
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

// Mails a one-time code to the account holder, for accounts that have no
// password. `shouldCreateUser: false` so this can never mint an account —
// GoTrue answers otp_disabled when no user row matches, which cannot happen
// here because the caller is already signed in.
export async function sendReauthCode(): Promise<void> {
  const { email, method } = await reauthAccount();
  // An account with a password has no business being mailed a code; this is
  // the same downgrade verifyUser refuses, at the other entry point.
  assertMethod("otp", method);

  // Its own bucket: each send spends from the project's shared mail budget,
  // which Supabase's built-in sender caps at 2/hour.
  if ((await checkRateLimit("reauth-code", email)) !== "allowed") {
    throw new Error("Too many codes requested. Please try again later.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    log.error("Re-auth code send failed", { err: error });
    throw new Error("Couldn't send a code. Please try again.");
  }
}

// Deletes every FINANCIAL row for a user, in FK-safe order. Transactions go
// first because Transaction.transferAccount is onDelete: Restrict — an account
// can't be removed while a transfer still points at it. Plans cascade to their
// child rows (assets, liabilities, incomes, expenses, events) and accounts
// cascade to their import batches, so neither needs its own deleteMany. Does
// NOT touch User, UserSettings, or Category. Returns the ops for a single
// $transaction.
function financialDeletes(userId: string) {
  return [
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.budgetItem.deleteMany({ where: { period: { userId } } }),
    prisma.balanceItem.deleteMany({ where: { period: { userId } } }),
    prisma.financialPeriod.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.plan.deleteMany({ where: { userId } }),
  ];
}

export async function exportMyData(): Promise<string> {
  const userId = await requireUserId();
  if ((await checkRateLimit("data-export", userId)) !== "allowed") {
    throw new Error("Too many export requests. Please try again later.");
  }
  const [
    user,
    settings,
    categories,
    accounts,
    periods,
    budgetItems,
    balanceItems,
    transactions,
    importBatches,
    plans,
    sentMessages,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.financialPeriod.findMany({ where: { userId } }),
    prisma.budgetItem.findMany({ where: { period: { userId } } }),
    prisma.balanceItem.findMany({ where: { period: { userId } } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.importBatch.findMany({ where: { userId } }),
    prisma.plan.findMany({
      where: { userId },
      include: {
        assets: true,
        liabilities: true,
        incomes: true,
        expenses: true,
        events: true,
      },
    }),
    prisma.sentMessage.findMany({ where: { userId } }),
  ]);

  return serializeExport({
    exportedAt: new Date().toISOString(),
    // v3 added sentMessages so the user's full communication history is included.
    schemaVersion: 3,
    user,
    settings,
    categories,
    accounts,
    periods,
    budgetItems,
    balanceItems,
    transactions,
    importBatches,
    plans,
    sentMessages,
  });
}

// Back to how the app looked on day one: every financial row goes, and the
// starter categories, accounts and £0 budget sheet are laid down again.
//
// One transaction, and the deletes are spelled out here rather than reusing
// financialDeletes because they must run in order against `tx` — the FK order
// that comment describes is the same, and Category goes too, which the other
// paths deliberately keep. Seeding after a partial delete would duplicate the
// starter categories, so the two halves cannot be separate transactions.
export async function resetToDefaults(proof: Reauthentication): Promise<void> {
  const userId = await requireUserId();
  await verifyUser(proof);

  await prisma.$transaction(async (tx) => {
    // Transactions first: Transaction.transferAccount is onDelete: Restrict,
    // so an account cannot go while a transfer still points at it.
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.budgetItem.deleteMany({ where: { period: { userId } } });
    await tx.balanceItem.deleteMany({ where: { period: { userId } } });
    await tx.financialPeriod.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.plan.deleteMany({ where: { userId } });
    // Unlike clearMyData: the starter data brings its own categories, and
    // keeping the old ones would leave two of each.
    await tx.category.deleteMany({ where: { userId } });

    await seedStarterData(tx, userId);
  });

  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/settings");
}

export async function clearMyData(proof: Reauthentication): Promise<void> {
  const userId = await requireUserId();
  await verifyUser(proof);
  await prisma.$transaction(financialDeletes(userId));
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/settings");
}

export async function deleteMyAccount(proof: Reauthentication): Promise<void> {
  const userId = await requireUserId();
  await verifyUser(proof);

  // App data first, identity second: if the admin call below failed, we'd have
  // erased the financial PII rather than orphaning it behind an undeletable
  // login. Single transaction; user.delete() last so FKs are already cleared.
  await prisma.$transaction([
    ...financialDeletes(userId),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.userSettings.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  // Erase the Supabase identity (email/password/OAuth) — needs the admin client.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // The financial rows are already gone, so a failure here leaves an auth
    // identity with no app data behind it — worth a durable trace.
    log.error("Account deletion left an orphaned auth identity", {
      userId,
      err: error,
    });
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }

  // A failed sign-out is tolerable here: the account is already deleted and the
  // session cookie expires on its own, so we don't block the redirect on it.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

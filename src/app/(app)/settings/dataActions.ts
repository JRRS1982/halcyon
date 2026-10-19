"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Reauthentication } from "@/lib/auth/reauth";
import type { ReauthOutcome } from "@/lib/auth/reauthOutcome";
import { refusalFor } from "@/lib/auth/reauthRefusal";
import { requireUserId } from "@/lib/auth/requireUserId";
import {
  assertMethod,
  REAUTH_ERRORS,
  reauthAccount,
  verifyUser,
} from "@/lib/auth/verifyUser";
import { serializeExport } from "@/lib/data/serialize";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { seedStarterData } from "@/lib/settings/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Mails a one-time code to the account holder, for accounts that have no
// password. `shouldCreateUser: false` so this can never mint an account —
// GoTrue answers otp_disabled when no user row matches, which cannot happen
// here because the caller is already signed in.
export async function sendReauthCode(): Promise<ReauthOutcome> {
  const { email, method } = await reauthAccount();
  try {
    // An account with a password has no business being mailed a code; this is
    // the same downgrade verifyUser refuses, at the other entry point.
    assertMethod("otp", method);

    // Its own bucket: each send spends from the project's shared mail budget,
    // which Supabase's built-in sender caps at 2/hour.
    if ((await checkRateLimit("reauth-code", email)) !== "allowed") {
      throw new Error(REAUTH_ERRORS.codeSendLimited);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      log.error("Re-auth code send failed", { err: error });
      throw new Error(REAUTH_ERRORS.codeSendFailed);
    }
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
  }
  return { ok: true };
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

export async function exportMyData(
  proof: Reauthentication,
): Promise<ReauthOutcome<{ json: string }>> {
  const userId = await requireUserId("/settings");
  // Handing over the whole financial record is at least as sensitive as
  // deleting it, so it takes the same proof as its three destructive siblings.
  // Without this an unlocked signed-in browser is a complete data breach.
  try {
    await verifyUser(proof);
    if ((await checkRateLimit("data-export", userId)) !== "allowed") {
      throw new Error(REAUTH_ERRORS.rateLimited);
    }
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
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

  const json = serializeExport({
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
  return { ok: true, json };
}

// Back to how the app looked on day one: every financial row goes, and the
// starter categories, accounts and £0 budget sheet are laid down again.
//
// One transaction, and the deletes are spelled out here rather than reusing
// financialDeletes because they must run in order against `tx` — the FK order
// that comment describes is the same, and Category goes too, which the other
// paths deliberately keep. Seeding after a partial delete would duplicate the
// starter categories, so the two halves cannot be separate transactions.
export async function resetToDefaults(
  proof: Reauthentication,
): Promise<ReauthOutcome> {
  const userId = await requireUserId("/settings");
  try {
    await verifyUser(proof);
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
  }

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
  return { ok: true };
}

export async function clearMyData(
  proof: Reauthentication,
): Promise<ReauthOutcome> {
  const userId = await requireUserId("/settings");
  try {
    await verifyUser(proof);
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
  }
  await prisma.$transaction(financialDeletes(userId));
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteMyAccount(
  proof: Reauthentication,
): Promise<ReauthOutcome> {
  const userId = await requireUserId("/settings");
  try {
    await verifyUser(proof);
  } catch (err) {
    return { ok: false, reason: refusalFor(err) };
  }

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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serializeExport } from "@/lib/data/serialize";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
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
  ]);

  return serializeExport({
    exportedAt: new Date().toISOString(),
    // v2 added importBatches and plans (with their nested rows), so "export my
    // data" really is everything the database holds for the user.
    schemaVersion: 2,
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
  });
}

export async function clearMyData(): Promise<void> {
  const userId = await requireUserId();
  await prisma.$transaction(financialDeletes(userId));
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/settings");
}

export async function deleteMyAccount(): Promise<void> {
  const userId = await requireUserId();

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

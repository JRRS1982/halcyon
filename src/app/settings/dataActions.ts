"use server";

import { serializeExport } from "@/lib/data/serialize";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

// Deletes every FINANCIAL row for a user, in FK-safe order. Transactions go
// first because Transaction.transferAccount is onDelete: Restrict — an account
// can't be removed while a transfer still points at it. Does NOT touch User,
// UserSettings, or Category. Returns the ops for a single $transaction.
function financialDeletes(userId: string) {
  return [
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.financialItem.deleteMany({ where: { period: { userId } } }),
    prisma.balanceItem.deleteMany({ where: { period: { userId } } }),
    prisma.financialPeriod.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.budgetTemplateItem.deleteMany({ where: { userId } }),
    prisma.balanceTemplateItem.deleteMany({ where: { userId } }),
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
    financialItems,
    balanceItems,
    budgetTemplateItems,
    balanceTemplateItems,
    transactions,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.financialPeriod.findMany({ where: { userId } }),
    prisma.financialItem.findMany({ where: { period: { userId } } }),
    prisma.balanceItem.findMany({ where: { period: { userId } } }),
    prisma.budgetTemplateItem.findMany({ where: { userId } }),
    prisma.balanceTemplateItem.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  return serializeExport({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    user,
    settings,
    categories,
    accounts,
    periods,
    financialItems,
    balanceItems,
    budgetTemplateItems,
    balanceTemplateItems,
    transactions,
  });
}

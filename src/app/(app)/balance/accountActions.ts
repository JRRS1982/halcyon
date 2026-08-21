"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AccountDeletionCounts,
  type AccountIdInput,
  accountIdSchema,
  type CreateAccountWithBalanceInput,
  createAccountWithBalanceSchema,
  type DeleteAccountEverywhereInput,
  deleteAccountEverywhereSchema,
} from "@/lib/accounts/schemas";
import { ensurePeriodForMonthIn } from "@/lib/budget/ensurePeriod";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/balance");
  return user.id;
}

function revalidateAll() {
  revalidatePath("/balance");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// Throws unless the account is the caller's. Every action starts here — the
// middleware guard is never the only fence (ADR-002).
async function requireOwnedAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new Error("Account not found");
  return account;
}

/**
 * One gesture, one transaction: the account, its first observation, and — for a
 * mortgaged property — the second account, its observation and the link.
 *
 * A `"use server"` export cannot take a transaction client, so the transaction
 * opens here rather than being passed in.
 */
export async function createAccountWithBalance(
  input: CreateAccountWithBalanceInput,
): Promise<{ periodId: string; accountId: string }> {
  const userId = await requireUserId();
  const parsed = createAccountWithBalanceSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  const result = await prisma.$transaction(async (tx) => {
    const period = await ensurePeriodForMonthIn(tx, userId, range);

    const last = await tx.balanceItem.findFirst({
      where: {
        periodId: period.id,
        type: parsed.type,
        category: parsed.category,
        deletedAt: null,
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let sortOrder = (last?.sortOrder ?? 0) + 1;

    const account = await tx.account.create({
      data: {
        userId,
        name: parsed.name,
        kind: parsed.type,
        category: parsed.category,
        wrapper: parsed.wrapper,
        canImportTransactions: parsed.canImportTransactions,
      },
    });

    await tx.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: parsed.type,
        category: parsed.category,
        label: parsed.name,
        value: parsed.value,
        sortOrder,
      },
    });

    if (parsed.mortgage) {
      const mortgage = await tx.account.create({
        data: {
          userId,
          name: parsed.mortgage.name,
          kind: "LIABILITY",
          category: parsed.category,
          canImportTransactions: parsed.mortgage.canImportTransactions,
          linkedAccountId: account.id,
        },
      });
      sortOrder += 1;
      await tx.balanceItem.create({
        data: {
          periodId: period.id,
          accountId: mortgage.id,
          type: "LIABILITY",
          category: parsed.category,
          label: parsed.mortgage.name,
          value: parsed.mortgage.value,
          sortOrder,
        },
      });
    }

    return { periodId: period.id, accountId: account.id };
  });

  revalidateAll();
  return result;
}

// Stop tracking: the account leaves next month's sheet and the pickers, and
// every observation already recorded stays exactly where it is.
export async function archiveAccount(input: AccountIdInput): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  await prisma.account.update({
    where: { id: accountId },
    data: { deletedAt: new Date() },
  });
  revalidateAll();
}

export async function restoreAccount(input: AccountIdInput): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  await prisma.account.update({
    where: { id: accountId },
    data: { deletedAt: null },
  });
  revalidateAll();
}

// What the confirmation panel says out loud. "Removes all 14 monthly values" is
// a very different sentence from "are you sure?", and it is the one that stops
// the mistake.
export async function accountDeletionCounts(
  input: AccountIdInput,
): Promise<AccountDeletionCounts> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  // The link is one-directional in the schema but symmetric in meaning: this
  // account may point at its partner, or be pointed at by it. Check both.
  const [months, budgetRows, own, pointedAtBy] = await Promise.all([
    prisma.balanceItem.count({ where: { accountId, deletedAt: null } }),
    prisma.financialItem.count({ where: { accountId, deletedAt: null } }),
    prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { linkedAccountId: true },
    }),
    prisma.account.findFirst({
      where: { userId, deletedAt: null, linkedAccountId: accountId },
      select: { id: true },
    }),
  ]);

  const partnerId = own.linkedAccountId ?? pointedAtBy?.id ?? null;
  if (!partnerId) return { months, budgetRows, linked: null };

  const partner = await prisma.account.findUniqueOrThrow({
    where: { id: partnerId },
    select: { id: true, name: true },
  });
  const latest = await prisma.balanceItem.findFirst({
    where: { accountId: partnerId, deletedAt: null },
    orderBy: { period: { startDate: "desc" } },
    select: { value: true },
  });

  return {
    months,
    budgetRows,
    linked: {
      accountId: partner.id,
      name: partner.name,
      latestValue: Number(latest?.value ?? 0),
    },
  };
}

/**
 * Remove the account and every trace of it. One transaction, so a linked pair
 * cannot half-succeed. Unticking the partner clears its link rather than
 * leaving it pointing at a row that no longer exists.
 */
export async function deleteAccountEverywhere(
  input: DeleteAccountEverywhereInput,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, alsoLinked } = deleteAccountEverywhereSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  const counts = await accountDeletionCounts({ accountId });
  const ids =
    alsoLinked && counts.linked
      ? [accountId, counts.linked.accountId]
      : [accountId];

  await prisma.$transaction(async (tx) => {
    await tx.balanceItem.deleteMany({ where: { accountId: { in: ids } } });
    await tx.financialItem.deleteMany({ where: { accountId: { in: ids } } });
    // Break links in both directions before deleting, so no survivor is left
    // pointing at a row that is about to disappear.
    await tx.account.updateMany({
      where: { userId, linkedAccountId: { in: ids } },
      data: { linkedAccountId: null },
    });
    await tx.account.updateMany({
      where: { id: { in: ids } },
      data: { linkedAccountId: null },
    });
    await tx.account.deleteMany({ where: { id: { in: ids }, userId } });
  });

  revalidateAll();
}

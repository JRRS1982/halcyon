"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildMortgageAccountData,
  buildPrimaryAccountData,
  nextSortOrder,
} from "@/lib/accounts/creation";
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
import { cleanLabel } from "@/lib/categories/normalize";
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
  revalidatePath("/transactions");
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

// Resolves the id of the account linked to `accountId`, in either direction —
// the link is one-directional in the schema (`linkedAccountId`) but symmetric
// in meaning: this account may point at its partner, or be pointed at by it.
//
// Scoped to `userId` on every read, including the final one. The value
// stored in `linkedAccountId` is not itself trustworthy cross-tenant data —
// nothing but this action's own write path currently keeps it pointed at a
// same-user sibling, and that's a convention, not a constraint the database
// enforces. A future feature that lets a user link accounts by picking an id
// would write straight into this column, so the last read re-verifies
// ownership rather than trusting the column's value.
//
// Neither direction filters on the partner's archived state: an archived
// partner is still linked, so both a size-checking dialog and a "delete the
// linked account too" gesture should still find it.
async function resolveLinkedPartnerId(
  userId: string,
  accountId: string,
): Promise<string | null> {
  const [own, pointedAtBy] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { linkedAccountId: true },
    }),
    prisma.account.findFirst({
      where: { userId, linkedAccountId: accountId },
      select: { id: true },
    }),
  ]);

  const candidateId = own?.linkedAccountId ?? pointedAtBy?.id ?? null;
  if (!candidateId) return null;

  const partner = await prisma.account.findFirst({
    where: { id: candidateId, userId },
    select: { id: true },
  });
  return partner?.id ?? null;
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

  const name = cleanLabel(parsed.name);

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

    const account = await tx.account.create({
      data: { userId, ...buildPrimaryAccountData(parsed) },
    });

    await tx.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: parsed.type,
        category: parsed.category,
        label: name,
        value: parsed.value,
        sortOrder: nextSortOrder(last?.sortOrder),
      },
    });

    if (parsed.mortgage) {
      const mortgageName = cleanLabel(parsed.mortgage.name);

      // buildMortgageAccountData always classifies this as a LONG_TERM
      // liability, a different bucket from the property's own row, so its
      // sortOrder is computed against that bucket rather than appended onto
      // the asset row's.
      const lastLiability = await tx.balanceItem.findFirst({
        where: {
          periodId: period.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          deletedAt: null,
        },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const mortgage = await tx.account.create({
        data: {
          userId,
          ...buildMortgageAccountData(parsed.mortgage),
          linkedAccountId: account.id,
        },
      });

      await tx.balanceItem.create({
        data: {
          periodId: period.id,
          accountId: mortgage.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: mortgageName,
          value: parsed.mortgage.value,
          sortOrder: nextSortOrder(lastLiability?.sortOrder),
        },
      });
    }

    return { periodId: period.id, accountId: account.id };
  });

  revalidateAll();
  return result;
}

// Stop tracking: the account leaves next month's sheet and the pickers, and
// every observation already recorded stays exactly where it is. A single
// statement rather than check-then-act: the `userId` filter on the update
// itself is the ownership check, so there's no gap between proving ownership
// and acting on it.
export async function archiveAccount(input: AccountIdInput): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);

  const result = await prisma.account.updateMany({
    where: { id: accountId, userId },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}

export async function restoreAccount(input: AccountIdInput): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);

  const result = await prisma.account.updateMany({
    where: { id: accountId, userId },
    data: { deletedAt: null },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}

// What the confirmation panel says out loud. "Removes all 14 monthly values
// and 6 imported transactions" is a very different sentence from "are you
// sure?", and it is the one that stops the mistake.
export async function accountDeletionCounts(
  input: AccountIdInput,
): Promise<AccountDeletionCounts> {
  const userId = await requireUserId();
  const { accountId } = accountIdSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  const [months, budgetRows, transactions, importBatches, partnerId] =
    await Promise.all([
      prisma.balanceItem.count({ where: { accountId, deletedAt: null } }),
      prisma.budgetItem.count({ where: { accountId, deletedAt: null } }),
      prisma.transaction.count({ where: { accountId } }),
      prisma.importBatch.count({ where: { accountId } }),
      resolveLinkedPartnerId(userId, accountId),
    ]);

  if (!partnerId) {
    return { months, budgetRows, transactions, importBatches, linked: null };
  }

  const [
    partner,
    latest,
    partnerMonths,
    partnerBudgetRows,
    partnerTransactions,
    partnerImportBatches,
  ] = await Promise.all([
    prisma.account.findFirstOrThrow({
      where: { id: partnerId, userId },
      select: { id: true, name: true },
    }),
    prisma.balanceItem.findFirst({
      where: { accountId: partnerId, deletedAt: null },
      orderBy: { period: { startDate: "desc" } },
      select: { value: true },
    }),
    // The partner's own counts — a paired delete (alsoLinked: true) destroys
    // these too, so the size of that delete is incomplete without them.
    prisma.balanceItem.count({
      where: { accountId: partnerId, deletedAt: null },
    }),
    prisma.budgetItem.count({
      where: { accountId: partnerId, deletedAt: null },
    }),
    prisma.transaction.count({ where: { accountId: partnerId } }),
    prisma.importBatch.count({ where: { accountId: partnerId } }),
  ]);

  return {
    months,
    budgetRows,
    transactions,
    importBatches,
    linked: {
      accountId: partner.id,
      name: partner.name,
      latestValue: Number(latest?.value ?? 0),
      months: partnerMonths,
      budgetRows: partnerBudgetRows,
      transactions: partnerTransactions,
      importBatches: partnerImportBatches,
    },
  };
}

/**
 * Remove the account and every trace of it: its balance/budget history, its
 * imported ledger, and — when asked — its linked property or mortgage. One
 * transaction, so a linked pair cannot half-succeed. Unticking the partner
 * clears its link rather than leaving it pointing at a row that no longer
 * exists.
 *
 * Refuses outright if some other account's transaction still names this
 * account (or the partner, when deleting both) as its transfer counterparty:
 * deleting that reference would either destroy a ledger the user never asked
 * to touch, or hit the `Restrict` the schema puts on
 * `Transaction.transferAccount` specifically so this can't happen silently.
 * A transaction that belongs to one of the accounts being deleted doesn't
 * count — it's leaving too.
 */
export async function deleteAccountEverywhere(
  input: DeleteAccountEverywhereInput,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, alsoLinked } = deleteAccountEverywhereSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  const partnerId = alsoLinked
    ? await resolveLinkedPartnerId(userId, accountId)
    : null;
  const ids = partnerId ? [accountId, partnerId] : [accountId];

  const blockingTransfers = await prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      transferAccountId: { in: ids },
      accountId: { notIn: ids },
    },
  });
  if (blockingTransfers > 0) {
    throw new Error(
      "This account still has transactions. Reassign or remove them first.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // The account's own ledger goes too — "delete it everywhere" means it,
    // not just the balance sheet. Deleted explicitly (rather than left to the
    // schema's Cascade) so accountDeletionCounts above can report the size of
    // what's about to happen.
    await tx.transaction.deleteMany({
      where: { accountId: { in: ids }, userId },
    });
    await tx.importBatch.deleteMany({
      where: { accountId: { in: ids }, userId },
    });
    // A soft-deleted transaction on some other, surviving account can still
    // carry a transferAccountId pointing at one of these ids — reverseImport
    // soft-deletes without clearing it. The refusal above only ever fires on
    // a live one, so any survivor here is already soft-deleted; clear the
    // reference rather than let it hit the schema's Restrict on the account
    // delete below.
    await tx.transaction.updateMany({
      where: {
        userId,
        transferAccountId: { in: ids },
        accountId: { notIn: ids },
      },
      data: { transferAccountId: null },
    });
    // Rows already soft-deleted are left alone here — the FK's own
    // ON DELETE SET NULL clears their accountId when the account goes,
    // which is exactly the behaviour under test elsewhere in this suite.
    await tx.balanceItem.deleteMany({
      where: { accountId: { in: ids }, deletedAt: null, period: { userId } },
    });
    await tx.budgetItem.deleteMany({
      where: { accountId: { in: ids }, deletedAt: null, period: { userId } },
    });
    // Break links in both directions before deleting, so no survivor is left
    // pointing at a row that is about to disappear.
    await tx.account.updateMany({
      where: { userId, linkedAccountId: { in: ids } },
      data: { linkedAccountId: null },
    });
    await tx.account.updateMany({
      where: { id: { in: ids }, userId },
      data: { linkedAccountId: null },
    });
    await tx.account.deleteMany({ where: { id: { in: ids }, userId } });
  });

  revalidateAll();
}

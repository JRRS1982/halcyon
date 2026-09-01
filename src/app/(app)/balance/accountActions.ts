"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  accountTypesOfKind,
  kindOf,
  wrapperOf,
} from "@/lib/accounts/accountDraft";
import {
  buildAccountData,
  buildMortgageAccountData,
  nextSortOrder,
} from "@/lib/accounts/creation";
import {
  type AccountDeletionCounts,
  type AccountIdInput,
  type ArchiveAccountInput,
  accountIdSchema,
  archiveAccountSchema,
  type CreateAccountInput,
  createAccountSchema,
  type DeleteAccountEverywhereInput,
  deleteAccountEverywhereSchema,
} from "@/lib/accounts/schemas";
import { isValidBalanceCategory } from "@/lib/balance/reorder";
import {
  type RenameAccountInput,
  renameAccountSchema,
  type SetAccountSectionInput,
  type SetAccountTypeInput,
  setAccountSectionSchema,
  setAccountTypeSchema,
} from "@/lib/balance/schemas";
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
  // renameAccount and deleteAccountEverywhere both touch BudgetItem rows
  // (label propagation, cascade delete respectively) in the same
  // transaction — every action in this file shares one revalidateAll rather
  // than each remembering its own paths, so /budget belongs here too.
  revalidatePath("/budget");
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
export async function createAccount(
  input: CreateAccountInput,
): Promise<{ periodId: string; accountId: string }> {
  const userId = await requireUserId();
  const parsed = createAccountSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  const name = cleanLabel(parsed.name);
  // The drawer sends the one type it asked for; everything else the row needs
  // — asset-or-liability included — is derived from it.
  const accountData = buildAccountData({
    type: parsed.type,
    section: parsed.section,
  });
  const kind = kindOf(parsed.type);

  const result = await prisma.$transaction(async (tx) => {
    const period = await ensurePeriodForMonthIn(tx, userId, range);

    const last = await tx.balanceItem.findFirst({
      where: {
        periodId: period.id,
        type: kind,
        category: parsed.section,
        deletedAt: null,
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const account = await tx.account.create({
      data: {
        userId,
        name,
        canImportTransactions: parsed.canImportTransactions,
        ...accountData,
      },
    });

    await tx.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: kind,
        category: parsed.section,
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

/**
 * Change what kind of account this is — Savings to a Stocks ISA, a plain Loan
 * to a Credit Card — without disturbing anything else about it. Refused
 * outright rather than silently worked around whenever something else in the
 * data model depends on the account staying exactly what it is; see the
 * inline reasons below.
 */
export async function setAccountType(
  input: SetAccountTypeInput,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, type } = setAccountTypeSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: {
        id: true,
        type: true,
        name: true,
        linkedAccountId: true,
        linkedBy: { select: { id: true } },
      },
    });
    if (!account) throw new Error("Account not found");
    if (account.type === type) return;

    // Same kind only: Sync keys plan rows by kind::accountId, and budget
    // anchors (assertAnchorMatches) rely on the kind never changing.
    if (kindOf(account.type) !== kindOf(type)) {
      throw new Error(
        "An account cannot change between asset and liability — create a new account instead",
      );
    }

    // A linked pair (property ↔ mortgage) is a structure; neither half may
    // change type while linked.
    if (account.linkedAccountId !== null || account.linkedBy !== null) {
      throw new Error(
        `${account.name} is linked to its mortgage/property — unlink or delete the pair first`,
      );
    }

    // Leaving PROPERTY with a sale event aimed at it would leave the event
    // pointing at a non-property. Refuse and NAME the blocker rather than
    // silently deleting the user's plan event.
    if (account.type === "PROPERTY") {
      const saleEvents = await tx.planEvent.count({
        where: {
          deletedAt: null,
          kind: "PROPERTY_SALE",
          saleAsset: { accountId: account.id, deletedAt: null },
          plan: { userId, deletedAt: null },
        },
      });
      if (saleEvents > 0) {
        throw new Error(
          `${account.name} has a property sale event in your plan — remove that first`,
        );
      }
    }

    // Section is the user's: a type change never moves the account. Mirrors
    // follow the type so old deployed code keeps agreeing.
    await tx.account.updateMany({
      where: { id: account.id, userId },
      data: { type, kind: kindOf(type), wrapper: wrapperOf(type) },
    });
  });
  revalidateAll();
}

// Moves an account directly into a chosen section, appending it to the end
// of that bucket. The bucket is scoped by the account's own kind (via
// accountTypesOfKind, never the stored kind mirror) so an ASSET's sortOrder
// never collides with a LIABILITY's in the same section.
export async function setAccountSection(
  input: SetAccountSectionInput,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, section } = setAccountSectionSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true, type: true, section: true },
    });
    if (!account) throw new Error("Account not found");

    const kind = kindOf(account.type);
    if (!isValidBalanceCategory(kind, section)) {
      throw new Error(`${section} is not a valid section for that account`);
    }
    if (account.section === section) return;

    const typesOfKind = accountTypesOfKind(kind).map((t) => t.id);
    const last = await tx.account.findFirst({
      where: {
        userId,
        deletedAt: null,
        section,
        type: { in: typesOfKind },
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await tx.account.updateMany({
      where: { id: account.id, userId },
      data: { section, sortOrder: nextSortOrder(last?.sortOrder) },
    });
  });
  revalidateAll();
}

// The one implementation behind both balance/accountActions.ts's own callers
// and settings/accountActions.ts's re-export — a rename touches the account's
// name plus every live budget/balance row's label mirror in the same
// transaction, so the sheets never show a stale name next to a fresh one.
export async function renameAccount(input: RenameAccountInput): Promise<void> {
  const userId = await requireUserId();
  const { accountId, name } = renameAccountSchema.parse(input);
  const label = cleanLabel(name);

  await prisma.$transaction(async (tx) => {
    const result = await tx.account.updateMany({
      where: { id: accountId, userId, deletedAt: null },
      data: { name: label },
    });
    if (result.count === 0) throw new Error("Account not found");

    // Scoped through the period in the same statement: the app-level userId
    // filter is the only fence (ADR-002), so a mirror update carries it too
    // rather than trusting the account lookup above to have proved ownership.
    await tx.budgetItem.updateMany({
      where: { accountId, deletedAt: null, period: { userId } },
      data: { label },
    });
    await tx.balanceItem.updateMany({
      where: {
        accountId,
        deletedAt: null,
        period: { userId, deletedAt: null },
      },
      data: { label },
    });
  });
  revalidateAll();
}

// Stop tracking: the account leaves the pickers and THIS month's sheet, and
// the months already closed keep what they recorded.
//
// From this month, not the next one: the user has just said they no longer
// track this account, so leaving it on the sheet in front of them reads as the
// button not having worked. Earlier months are untouched — those are
// observations that were true when they were made, which is what separates
// archiving from deleting everywhere.
//
// A mortgaged property takes its mortgage with it when `alsoLinked`. A debt
// secured on a property nobody tracks any more has nothing to sit against, and
// would otherwise keep appearing on its own.
export async function archiveAccount(
  input: ArchiveAccountInput,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, alsoLinked, fromYear, fromMonth } =
    archiveAccountSchema.parse(input);

  const partnerId = alsoLinked
    ? await resolveLinkedPartnerId(userId, accountId)
    : null;
  const ids = partnerId ? [accountId, partnerId] : [accountId];

  // The first day of the month the user is on: every period starting on or
  // after it is "this month and onwards".
  const from = new Date(Date.UTC(fromYear, fromMonth, 1));

  await prisma.$transaction(async (tx) => {
    const result = await tx.account.updateMany({
      where: { id: { in: ids }, userId },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new Error("Account not found");

    await tx.balanceItem.updateMany({
      where: {
        accountId: { in: ids },
        deletedAt: null,
        period: { userId, deletedAt: null, startDate: { gte: from } },
      },
      data: { deletedAt: new Date() },
    });
  });
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
    // Only the live rows are deleted explicitly — they are the ones
    // accountDeletionCounts counted for the confirmation panel, so what the
    // user was told is going is exactly what these two statements remove.
    // The rest goes with the account below: BalanceItem.accountId is required
    // and ON DELETE CASCADE, so the soft-deleted months disappear with it;
    // BudgetItem.accountId is nullable and ON DELETE SET NULL, so its
    // soft-deleted rows survive with the link cleared.
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

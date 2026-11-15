"use server";

import type { AccountType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { accountTypesOfKind, kindOf } from "@/lib/accounts/accountDraft";
import { createAccountWithinCap } from "@/lib/accounts/createWithinCap";
import {
  buildAccountData,
  buildMortgageAccountData,
  nextSortOrder,
} from "@/lib/accounts/creation";
import {
  accountLimitError,
  MAX_ACCOUNTS_PER_USER,
} from "@/lib/accounts/limits";
import {
  type AccountDeletionCounts,
  type AccountIdInput,
  type AccountTermsInput,
  type ArchiveAccountInput,
  accountIdSchema,
  archiveAccountSchema,
  type CreateAccountInput,
  createAccountSchema,
  type DeleteAccountEverywhereInput,
  deleteAccountEverywhereSchema,
  disallowedTerms,
  setAccountTermsSchema,
} from "@/lib/accounts/schemas";
import { assertAccountNameFree } from "@/lib/accounts/uniqueName";
import { requireUserId } from "@/lib/auth/requireUserId";
import { createBalanceItemWithinCap } from "@/lib/balance/createWithinCap";
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

// An empty terms payload means the user answered nothing, so there is no row
// to write. A row of all-nulls would be indistinguishable in behaviour but
// would make "has this account been configured?" unanswerable.
const hasAnyTerm = (terms: AccountTermsInput): boolean =>
  Object.values(terms).some((v) => v !== undefined && v !== null);

// Refuses a parameter the account type does not prompt for. A stored value no
// card renders is invisible, uncleanable and still read by Sync, so the door
// is here rather than left to reality.ts's gate to ignore afterwards.
function requireTermsOfType(type: AccountType, terms: AccountTermsInput): void {
  const rejected = disallowedTerms(type, terms);
  if (rejected.length === 0) return;
  throw new Error(
    `A ${type} account has no ${rejected.join(", ")} — that is not one of its parameters`,
  );
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
  // And /plan, because an account IS a plan row: Sync compares its label,
  // its type (which decides the wrapper and which parameters travel), its
  // parameters and whether it exists at all. Every action here mutates at
  // least one of those, so leaving /plan out left the Sync indicator showing
  // a stale count after a rename or a type change until something else
  // happened to refresh it.
  revalidatePath("/plan");
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
  const userId = await requireUserId("/balance");
  const parsed = createAccountSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  const name = cleanLabel(parsed.name);
  // Both halves are checked against the type they will be stored under: the
  // drawer's picker can change after the Advanced section has been filled in,
  // and a mortgage's terms belong to a MORTGAGE however the property was
  // filed.
  requireTermsOfType(parsed.type, parsed.terms);
  if (parsed.mortgage) requireTermsOfType("MORTGAGE", parsed.mortgage.terms);
  // The drawer sends the one type it asked for; everything else the row needs
  // — asset-or-liability included — is derived from it.
  const accountData = buildAccountData({
    type: parsed.type,
    section: parsed.section,
  });
  const kind = kindOf(parsed.type);

  const result = await prisma.$transaction(async (tx) => {
    const period = await ensurePeriodForMonthIn(tx, userId, range);

    // sortOrder appends to the end of this account's (kind, section) bucket
    // — same convention setAccountSection uses when it moves an account.
    const typesOfKind = accountTypesOfKind(kind).map((t) => t.id);
    const last = await tx.account.findFirst({
      where: {
        userId,
        deletedAt: null,
        section: parsed.section,
        type: { in: typesOfKind },
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const account = await createAccountWithinCap(tx.account, {
      userId,
      name,
      canImportTransactions: parsed.canImportTransactions,
      sortOrder: nextSortOrder(last?.sortOrder),
      ...accountData,
    });

    await createBalanceItemWithinCap(tx.balanceItem, {
      periodId: period.id,
      accountId: account.id,
      value: parsed.value,
    });

    if (hasAnyTerm(parsed.terms)) {
      await tx.accountTerms.create({
        data: { accountId: account.id, ...parsed.terms },
      });
    }

    if (parsed.mortgage) {
      // buildMortgageAccountData always classifies this as a LONG_TERM
      // liability, a different bucket from the property's own row, so its
      // sortOrder is computed against that bucket rather than appended onto
      // the asset row's.
      const lastLiability = await tx.account.findFirst({
        where: {
          userId,
          deletedAt: null,
          section: "LONG_TERM",
          type: { in: accountTypesOfKind("LIABILITY").map((t) => t.id) },
        },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      // Its own cap check, not one shared with the property above. A pair
      // created at the ceiling would otherwise put two rows past a single
      // count — small, but the kind of overshoot that only ever grows.
      const mortgage = await createAccountWithinCap(tx.account, {
        userId,
        ...buildMortgageAccountData(parsed.mortgage),
        sortOrder: nextSortOrder(lastLiability?.sortOrder),
        linkedAccountId: account.id,
      });

      await createBalanceItemWithinCap(tx.balanceItem, {
        periodId: period.id,
        accountId: mortgage.id,
        value: parsed.mortgage.value,
      });

      if (hasAnyTerm(parsed.mortgage.terms)) {
        await tx.accountTerms.create({
          data: { accountId: mortgage.id, ...parsed.mortgage.terms },
        });
      }
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
  const userId = await requireUserId("/balance");
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

    // Section is the user's: a type change never moves the account.
    await tx.account.updateMany({
      where: { id: account.id, userId },
      data: { type },
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
  const userId = await requireUserId("/balance");
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
// name plus every live budget row's label mirror in the same transaction, so
// the budget sheet never shows a stale name next to a fresh one. BalanceItem
// carries no label mirror to fan out to — the balance sheet always reads the
// account's name directly.
export async function renameAccount(input: RenameAccountInput): Promise<void> {
  const userId = await requireUserId("/balance");
  const { accountId, name } = renameAccountSchema.parse(input);
  const label = cleanLabel(name);

  await prisma.$transaction(async (tx) => {
    await assertAccountNameFree(tx.account, userId, label, accountId);
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
  const userId = await requireUserId("/balance");
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

// Writes the projection parameters for one account — absent keys are left
// alone, `null` clears them back to the account type's default. See
// accountTermsSchema for why those two are not the same thing.
//
// Refuses anything the account's own type does not prompt for: the type comes
// from the row, never from the payload, so no caller can widen what it may
// write by claiming a different one.
export async function setAccountTerms(input: unknown): Promise<void> {
  const { accountId, terms } = setAccountTermsSchema.parse(input);
  const userId = await requireUserId("/balance");

  await prisma.$transaction(async (tx) => {
    // Ownership is the primary boundary (ADR-002: the server role bypasses
    // RLS), and it is checked inside the transaction so a concurrent delete
    // cannot slip between the check and the write. The type rides along on
    // the same read — it is the other thing this write has to be checked
    // against.
    const owned = await tx.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true, type: true },
    });
    if (!owned) throw new Error("Account not found");
    requireTermsOfType(owned.type, terms);

    // upsert, not update: the first write for an account has no row yet, and
    // an account is created without terms.
    await tx.accountTerms.upsert({
      where: { accountId },
      create: { accountId, ...terms },
      update: terms,
    });
  });

  // The same paths as every other action here — /plan among them, because a
  // term change makes the plan stale.
  revalidateAll();
}

export async function restoreAccount(input: AccountIdInput): Promise<void> {
  const userId = await requireUserId("/balance");
  const { accountId } = accountIdSchema.parse(input);

  // Un-archiving puts a row back on the sheet, so it has to respect the sheet's
  // ceiling the way creating one does. Without this the live cap could be
  // exceeded without a single create: archive to the floor, create more,
  // restore the lot.
  const live = await prisma.account.count({
    where: { userId, deletedAt: null },
  });
  if (live >= MAX_ACCOUNTS_PER_USER) throw accountLimitError();

  // While it was archived its name was free, and may since have been taken.
  const archived = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { name: true },
  });
  if (!archived) throw new Error("Account not found");
  await assertAccountNameFree(prisma.account, userId, archived.name, accountId);

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
  const userId = await requireUserId("/balance");
  const { accountId } = accountIdSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  const [
    months,
    budgetRows,
    transactions,
    importBatches,
    liveTransactions,
    incomingTransfers,
    partnerId,
  ] = await Promise.all([
    prisma.balanceItem.count({ where: { accountId, deletedAt: null } }),
    prisma.budgetItem.count({ where: { accountId, deletedAt: null } }),
    prisma.transaction.count({ where: { accountId } }),
    prisma.importBatch.count({ where: { accountId } }),
    prisma.transaction.count({ where: { accountId, deletedAt: null } }),
    prisma.transaction.count({
      where: {
        userId,
        deletedAt: null,
        transferAccountId: accountId,
        accountId: { not: accountId },
      },
    }),
    resolveLinkedPartnerId(userId, accountId),
  ]);
  const own = {
    months,
    budgetRows,
    transactions,
    importBatches,
    liveTransactions,
    incomingTransfers,
  };

  if (!partnerId) return { ...own, linked: null };

  const [
    partner,
    latest,
    partnerMonths,
    partnerBudgetRows,
    partnerTransactions,
    partnerImportBatches,
    partnerLiveTransactions,
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
    prisma.transaction.count({
      where: { accountId: partnerId, deletedAt: null },
    }),
  ]);

  return {
    ...own,
    linked: {
      accountId: partner.id,
      name: partner.name,
      latestValue: Number(latest?.value ?? 0),
      months: partnerMonths,
      budgetRows: partnerBudgetRows,
      transactions: partnerTransactions,
      importBatches: partnerImportBatches,
      liveTransactions: partnerLiveTransactions,
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
 * The ledger is the user's choice: deleted with the account, or moved to
 * `moveTransactionsTo` (imports and all), which is how a duplicate account is
 * merged into the real one. Another account's transfer that names a deleted
 * account follows its rows to the new account, or — when they are deleted —
 * stops being a transfer and is left for the user to file. Either way it
 * never reaches the `Restrict` the schema puts on `Transaction.transferAccount`.
 */
export async function deleteAccountEverywhere(
  input: DeleteAccountEverywhereInput,
): Promise<void> {
  const userId = await requireUserId("/balance");
  const { accountId, alsoLinked, moveTransactionsTo } =
    deleteAccountEverywhereSchema.parse(input);
  await requireOwnedAccount(userId, accountId);

  const partnerId = alsoLinked
    ? await resolveLinkedPartnerId(userId, accountId)
    : null;
  const ids = partnerId ? [accountId, partnerId] : [accountId];

  if (moveTransactionsTo) {
    if (ids.includes(moveTransactionsTo)) {
      throw new Error("Choose an account that is staying");
    }
    // Live as well as owned: rows moved into an archived account would vanish
    // from every picker with it.
    const target = await prisma.account.findFirst({
      where: { id: moveTransactionsTo, userId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new Error("Account not found");
  }

  await prisma.$transaction(async (tx) => {
    if (moveTransactionsTo) {
      // Every row moves, soft-deleted ones included: a reversed import's
      // rows belong to a batch that moves too, so Undo import still works.
      await tx.transaction.updateMany({
        where: { accountId: { in: ids }, userId },
        data: { accountId: moveTransactionsTo },
      });
      await tx.importBatch.updateMany({
        where: { accountId: { in: ids }, userId },
        data: { accountId: moveTransactionsTo },
      });
      await tx.transaction.updateMany({
        where: { userId, transferAccountId: { in: ids } },
        data: { transferAccountId: moveTransactionsTo },
      });
      // A transfer between the two accounts is now within one.
      await tx.transaction.updateMany({
        where: {
          userId,
          accountId: moveTransactionsTo,
          transferAccountId: moveTransactionsTo,
        },
        data: { transferAccountId: null },
      });
    } else {
      // Deleted explicitly (rather than left to the schema's Cascade) so
      // accountDeletionCounts above can report the size of what's about to
      // happen.
      await tx.transaction.deleteMany({
        where: { accountId: { in: ids }, userId },
      });
      await tx.importBatch.deleteMany({
        where: { accountId: { in: ids }, userId },
      });
      // Live or soft-deleted (reverseImport does not clear it), a transfer
      // whose counterparty is going stops being a transfer.
      await tx.transaction.updateMany({
        where: { userId, transferAccountId: { in: ids } },
        data: { transferAccountId: null },
      });
    }
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

"use server";

import type { AccountKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categorySectionSchema } from "@/lib/budget/schemas";
import { cleanLabel } from "@/lib/categories/normalize";
import { sectionFor, sectionLabel } from "@/lib/categories/sections";
import { prisma } from "@/lib/prisma";
import { requireTransactionsEnabled } from "@/lib/settings/server";
import { transactionFingerprint } from "@/lib/transactions/dedupe";
import {
  type ColumnMapping,
  MAX_EXTRA_COLUMNS,
  mapRows,
} from "@/lib/transactions/import";
import {
  MAX_IMPORT_ROWS,
  MAX_TRANSACTIONS_PER_USER,
} from "@/lib/transactions/limits";
import {
  buildCategoryMemory,
  descriptionKey,
  MEMORY_WINDOW,
} from "@/lib/transactions/memory";
import type { LedgerCategory } from "@/lib/transactions/server";

const mappingSchema = z.object({
  dateColumn: z.number().int().min(0),
  amountColumn: z.number().int().min(0),
  descriptionColumn: z.number().int().min(0),
  dateFormat: z.enum(["DMY", "MDY", "YMD"]),
  hasHeader: z.boolean(),
  extraColumns: z
    .array(z.number().int().min(0))
    .max(MAX_EXTRA_COLUMNS)
    .optional(),
});

const importSchema = z.object({
  accountId: z.string().uuid().nullable(),
  newAccountName: z.string().trim().max(120).nullable(),
  rows: z.array(z.array(z.string())).max(MAX_IMPORT_ROWS),
  mapping: mappingSchema,
});

export type ImportInput = z.input<typeof importSchema>;

const commitSchema = importSchema.extend({
  // Data-row indexes the user chose NOT to import (flagged duplicates they
  // confirmed are true re-uploads).
  skipIndexes: z.array(z.number().int()).default([]),
  // Shown in the reverse-import picker to identify the batch.
  fileName: z.string().trim().max(200).nullable().optional(),
});

export type CommitInput = z.input<typeof commitSchema>;

// A row flagged as a likely duplicate of an existing transaction, for the
// confirmation step.
export type DuplicateRow = {
  index: number;
  date: string;
  description: string;
  amount: number;
};

export type ImportPreview = {
  duplicates: DuplicateRow[];
  validCount: number;
  invalidCount: number;
};

export type ImportResult = {
  imported: number;
  duplicates: number;
  invalid: number;
  // How many imported rows were filed automatically from the user's own
  // categorisation history.
  autoCategorised: number;
  accountName: string;
};

// Resolves the target account: an existing one (ownership-checked) or a newly
// created one from the typed name. Throws if neither is usable.
async function resolveAccount(
  userId: string,
  accountId: string | null,
  newAccountName: string | null,
): Promise<{ id: string; name: string }> {
  if (accountId) {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) throw new Error("Account not found");
    return existing;
  }

  const name = cleanLabel(newAccountName ?? "");
  if (!name) throw new Error("An account is required to import");
  const created = await prisma.account.create({
    data: { userId, name },
    select: { id: true, name: true },
  });
  return created;
}

// Maps + splits the parsed CSV into importable (valid) rows and an invalid
// count. Shared by preview and commit so both see identical row indexes.
function splitRows(rows: string[][], mapping: ColumnMapping) {
  const mapped = mapRows(rows, mapping);
  const valid = mapped.filter(
    (row) => row.errors.length === 0 && row.date && row.amount !== null,
  );
  return { valid, invalidCount: mapped.length - valid.length };
}

// Step 1 of import: flags which valid rows look like duplicates of existing
// transactions in the chosen account, so the user can confirm before committing.
// A brand-new account has nothing to match against, so never flags anything.
// Does NOT write — no account is created here.
export async function previewImport(
  input: ImportInput,
): Promise<ImportPreview> {
  const userId = await requireTransactionsEnabled();
  const { accountId, rows, mapping } = importSchema.parse(input);
  const { valid, invalidCount } = splitRows(rows, mapping as ColumnMapping);

  const duplicates: DuplicateRow[] = [];
  if (accountId && valid.length > 0) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true },
    });
    if (account) {
      const dates = valid.map((row) => row.date as Date);
      const min = new Date(Math.min(...dates.map((d) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d) => d.getTime())));
      const existing = await prisma.transaction.findMany({
        where: {
          userId,
          accountId,
          deletedAt: null,
          date: { gte: min, lte: max },
        },
        select: { date: true, amount: true, description: true },
      });
      const seen = new Set(
        existing.map((tx) =>
          transactionFingerprint({
            accountId,
            date: tx.date,
            amount: Number(tx.amount),
            description: tx.description,
          }),
        ),
      );
      for (const row of valid) {
        const fp = transactionFingerprint({
          accountId,
          date: row.date as Date,
          amount: row.amount as number,
          description: row.description,
        });
        if (seen.has(fp)) {
          duplicates.push({
            index: row.index,
            date: (row.date as Date).toISOString(),
            description: row.description,
            amount: row.amount as number,
          });
        }
      }
    }
  }

  return { duplicates, validCount: valid.length, invalidCount };
}

// Step 2 of import: resolves/creates the account and inserts every valid row
// except the ones the user chose to skip (confirmed duplicates).
export async function commitImport(input: CommitInput): Promise<ImportResult> {
  const userId = await requireTransactionsEnabled();
  const { accountId, newAccountName, rows, mapping, skipIndexes, fileName } =
    commitSchema.parse(input);

  const account = await resolveAccount(userId, accountId, newAccountName);
  const { valid, invalidCount } = splitRows(rows, mapping as ColumnMapping);

  const skip = new Set(skipIndexes);
  const toInsert = valid.filter((row) => !skip.has(row.index));

  let autoCategorised = 0;
  if (toInsert.length > 0) {
    // Bound the total a single user can accumulate across all imports. Counting
    // live rows (deletedAt: null) keeps reversed/deleted batches from counting
    // against the cap, and fails closed: if the count query throws, the import
    // does not proceed.
    const existing = await prisma.transaction.count({
      where: { userId, deletedAt: null },
    });
    if (existing + toInsert.length > MAX_TRANSACTIONS_PER_USER) {
      throw new Error(
        `Import would exceed the ${MAX_TRANSACTIONS_PER_USER.toLocaleString()} transaction limit`,
      );
    }

    // Categorisation memory: how the user filed each merchant last time.
    // Rebuilt from recent history on every import (nothing stored), and
    // restricted to live categories so a deleted one is never resurrected.
    const history = await prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        categoryId: { not: null },
        category: { deletedAt: null },
      },
      orderBy: { date: "desc" },
      take: MEMORY_WINDOW,
      select: { description: true, categoryId: true, date: true },
    });
    const memory = buildCategoryMemory(
      history.flatMap((tx) =>
        tx.categoryId
          ? [
              {
                description: tx.description,
                categoryId: tx.categoryId,
                date: tx.date,
              },
            ]
          : [],
      ),
    );

    // The batch groups this run's rows so the whole import can be reversed.
    const batch = await prisma.importBatch.create({
      data: { userId, accountId: account.id, fileName: fileName ?? null },
      select: { id: true },
    });
    await prisma.transaction.createMany({
      data: toInsert.map((row) => {
        const categoryId = memory.get(descriptionKey(row.description)) ?? null;
        if (categoryId) autoCategorised += 1;
        return {
          userId,
          accountId: account.id,
          importBatchId: batch.id,
          date: row.date as Date,
          amount: row.amount as number,
          description: row.description,
          categoryId,
          // Kept CSV columns, keyed by header label (undefined leaves NULL).
          extra: row.extra ?? undefined,
        };
      }),
    });
  }

  // Imported transactions change category actuals on the budget + dashboard,
  // and the ledger on this page.
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return {
    imported: toInsert.length,
    duplicates: valid.length - toInsert.length,
    invalid: invalidCount,
    autoCategorised,
    accountName: account.name,
  };
}

// A reversible import run, for the reverse-import picker.
export type ImportBatchSummary = {
  id: string;
  createdAt: string;
  fileName: string | null;
  accountName: string;
  // Live (not individually deleted) transactions still in the batch.
  count: number;
};

// Recent imports that can still be reversed: not already reversed, and with at
// least one live transaction left to remove.
export async function listImportBatches(): Promise<ImportBatchSummary[]> {
  const userId = await requireTransactionsEnabled();

  const batches = await prisma.importBatch.findMany({
    where: { userId, reversedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      fileName: true,
      account: { select: { name: true } },
    },
  });
  if (batches.length === 0) return [];

  const counts = await prisma.transaction.groupBy({
    by: ["importBatchId"],
    where: {
      userId,
      deletedAt: null,
      importBatchId: { in: batches.map((b) => b.id) },
    },
    _count: { _all: true },
  });
  const countFor = new Map(counts.map((c) => [c.importBatchId, c._count._all]));

  return batches
    .map((b) => ({
      id: b.id,
      createdAt: b.createdAt.toISOString(),
      fileName: b.fileName,
      accountName: b.account.name,
      count: countFor.get(b.id) ?? 0,
    }))
    .filter((b) => b.count > 0);
}

const reverseSchema = z.object({ batchId: z.string().uuid() });

// Reverses one import: soft-deletes the batch's live transactions and stamps
// the batch reversedAt so it leaves the picker. Ownership-scoped throughout.
export async function reverseImport(
  input: z.input<typeof reverseSchema>,
): Promise<{ reversed: number; accountName: string }> {
  const userId = await requireTransactionsEnabled();
  const { batchId } = reverseSchema.parse(input);

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId, reversedAt: null },
    select: { id: true, account: { select: { name: true } } },
  });
  if (!batch) throw new Error("Import not found");

  const result = await prisma.transaction.updateMany({
    where: { importBatchId: batchId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { reversedAt: new Date() },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return { reversed: result.count, accountName: batch.account.name };
}

const setCategorySchema = z.object({
  transactionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
});

// Assigns (or clears) a transaction's category. Both the transaction and the
// category must belong to the signed-in user. Revalidates the budget/dashboard
// since this changes computed actuals.
export async function setTransactionCategory(
  input: z.input<typeof setCategorySchema>,
): Promise<void> {
  const userId = await requireTransactionsEnabled();
  const { transactionId, categoryId } = setCategorySchema.parse(input);

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new Error("Category not found");
  }

  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    // Category and transfer are mutually exclusive — assigning (or clearing) a
    // category always clears any transfer counterparty.
    data: { categoryId, transferAccountId: null },
  });
  if (result.count === 0) throw new Error("Transaction not found");

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  // A plain calendar date from the form's date input; parsed at UTC midnight
  // to match how imports store statement dates.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(300),
  // Bank-signed, like imported rows: negative for money out, positive for
  // money in. Zero records nothing and is refused.
  amount: z
    .number()
    .finite()
    .refine((v) => v !== 0, { message: "Amount can't be zero" }),
  categoryId: z.string().uuid().nullable(),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

// Quick-add: one transaction typed straight into the ledger — cash spend, a
// mid-month capture, anything that shouldn't wait for the next statement.
// Not part of any import batch, so reverse-import never touches it.
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<{ id: string }> {
  const userId = await requireTransactionsEnabled();
  const parsed = createTransactionSchema.parse(input);

  const account = await prisma.account.findFirst({
    where: { id: parsed.accountId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new Error("Account not found");

  if (parsed.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.categoryId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new Error("Category not found");
  }

  // The same per-user ceiling commitImport enforces. Quick-add is a second
  // write path into the same table, and a loop over it grows that table just
  // as effectively as a loop over the import — a cap on one route only is not
  // a cap.
  const existing = await prisma.transaction.count({
    where: { userId, deletedAt: null },
  });
  if (existing + 1 > MAX_TRANSACTIONS_PER_USER) {
    throw new Error(
      `You have reached the ${MAX_TRANSACTIONS_PER_USER.toLocaleString()} transaction limit`,
    );
  }

  const created = await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      date: new Date(`${parsed.date}T00:00:00.000Z`),
      amount: parsed.amount,
      description: parsed.description,
      categoryId: parsed.categoryId,
    },
    select: { id: true },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return created;
}

const setNoteSchema = z.object({
  transactionId: z.string().uuid(),
  note: z.string().trim().max(2000),
});

// Sets (or clears, when empty) a transaction's free-text note. Notes are
// human-written annotations — import metadata lives in `extra`.
export async function setTransactionNote(
  input: z.input<typeof setNoteSchema>,
): Promise<void> {
  const userId = await requireTransactionsEnabled();
  const { transactionId, note } = setNoteSchema.parse(input);

  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    data: { note: note === "" ? null : note },
  });
  if (result.count === 0) throw new Error("Transaction not found");

  revalidatePath("/transactions");
}

const bulkSetCategorySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  categoryId: z.string().uuid().nullable(),
});

// Bulk form of setTransactionCategory: assigns (or clears) a category across
// many transactions at once. The ownership filter silently skips any id that
// isn't the signed-in user's. Returns how many rows actually changed.
export async function bulkSetTransactionCategory(
  input: z.input<typeof bulkSetCategorySchema>,
): Promise<{ updated: number }> {
  const userId = await requireTransactionsEnabled();
  const { transactionIds, categoryId } = bulkSetCategorySchema.parse(input);

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new Error("Category not found");
  }

  const result = await prisma.transaction.updateMany({
    where: { id: { in: transactionIds }, userId, deletedAt: null },
    data: { categoryId, transferAccountId: null },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { updated: result.count };
}

const bulkDeleteSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
});

// Soft-deletes transactions in bulk: sets deletedAt so the rows drop out of
// the ledger and every computed actual. Ownership-scoped like all mutations.
export async function bulkDeleteTransactions(
  input: z.input<typeof bulkDeleteSchema>,
): Promise<{ deleted: number }> {
  const userId = await requireTransactionsEnabled();
  const { transactionIds } = bulkDeleteSchema.parse(input);

  const result = await prisma.transaction.updateMany({
    where: { id: { in: transactionIds }, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { deleted: result.count };
}

const bulkSetTransferSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  accountId: z.string().uuid(),
});

// Bulk form of setTransactionTransfer: tags many transactions as transfers to
// the same counterparty account. Rows that belong to the target account are
// skipped — a transfer to itself is meaningless — as is any id that isn't the
// signed-in user's. Returns how many rows actually changed so the caller can
// be honest about skips.
export async function bulkSetTransactionTransfer(
  input: z.input<typeof bulkSetTransferSchema>,
): Promise<{ updated: number }> {
  const userId = await requireTransactionsEnabled();
  const { transactionIds, accountId } = bulkSetTransferSchema.parse(input);

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new Error("Account not found");

  const result = await prisma.transaction.updateMany({
    where: {
      id: { in: transactionIds },
      userId,
      deletedAt: null,
      accountId: { not: accountId },
    },
    // Transfer and category are mutually exclusive — see setTransactionTransfer.
    data: { transferAccountId: accountId, categoryId: null },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { updated: result.count };
}

const setTransferSchema = z.object({
  transactionId: z.string().uuid(),
  accountId: z.string().uuid(),
});

// Tags a transaction as a transfer to/from one of the user's own accounts: sets
// transferAccountId and clears any category (mutually exclusive). The
// counterparty must belong to the user, be active, and differ from the
// transaction's own owning account (a transfer to itself is meaningless).
export async function setTransactionTransfer(
  input: z.input<typeof setTransferSchema>,
): Promise<void> {
  const userId = await requireTransactionsEnabled();
  const { transactionId, accountId } = setTransferSchema.parse(input);

  const [account, transaction] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.transaction.findFirst({
      where: { id: transactionId, userId, deletedAt: null },
      select: { accountId: true },
    }),
  ]);
  if (!account) throw new Error("Account not found");
  if (!transaction) throw new Error("Transaction not found");
  if (transaction.accountId === accountId) {
    throw new Error("A transfer must be to a different account");
  }

  await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    data: { transferAccountId: accountId, categoryId: null },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

const createAccountAndTransferSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  name: z.string().trim().min(1).max(120),
});

// Creates an account inline from the ledger transfer picker (when the user has
// none yet) and tags the transaction(s) as transfers to it, in one call.
//
// One action, not createAccount followed by setTransactionTransfer: the ledger
// updated optimistically between the two, so a user who navigated in that gap
// had the second request cancelled and ended up with a new account and an
// untagged transaction, having been shown the opposite. One round trip removes
// the window, and one database transaction means a failed tag leaves no
// orphaned account behind.
export async function createAccountAndTransfer(
  input: z.input<typeof createAccountAndTransferSchema>,
): Promise<{ id: string; name: string; kind: AccountKind }> {
  const userId = await requireTransactionsEnabled();
  const { transactionIds, name } = createAccountAndTransferSchema.parse(input);

  const created = await prisma.$transaction(async (tx) => {
    // No kind is passed, so this account is created kind: NONE (the schema
    // default) — a plain transfer target, same as most current/checking
    // accounts. It still lands in the ledger picker's Transfers group.
    const account = await tx.account.create({
      data: { userId, name: cleanLabel(name) },
      select: { id: true, name: true, kind: true },
    });

    // A freshly-created account can't own any existing transaction, so no
    // self-transfer check is needed here (unlike setTransactionTransfer).
    const result = await tx.transaction.updateMany({
      where: { id: { in: transactionIds }, userId, deletedAt: null },
      // Transfer and category are mutually exclusive — see setTransactionTransfer.
      data: { transferAccountId: account.id, categoryId: null },
    });
    if (result.count === 0) throw new Error("Transaction not found");

    return account;
  });

  revalidatePath("/transactions");
  revalidatePath("/settings");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return created;
}

const createAndAssignCategorySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["INCOME", "EXPENSE"]),
  // The budget section this category belongs to, so it can be placed on the
  // budget.
  section: categorySectionSchema,
});

// Creates a category and assigns it to the given transaction(s), in one call.
//
// One action, not createCategory followed by setTransactionCategory: the ledger
// showed the row as categorised as soon as the first returned, so a user who
// navigated before the second landed had it cancelled — left with a category
// that exists, a transaction that was never categorised, and a screen that had
// already told them otherwise. One database transaction also means a failed
// assignment rolls the category back rather than orphaning it.
export async function createAndAssignCategory(
  input: z.input<typeof createAndAssignCategorySchema>,
): Promise<LedgerCategory> {
  const userId = await requireTransactionsEnabled();
  const { transactionIds, label, type, section } =
    createAndAssignCategorySchema.parse(input);
  const resolvedSection = sectionFor(type, section);

  const created = await prisma.$transaction(async (tx) => {
    const newCategory = await tx.category.create({
      data: {
        userId,
        label: cleanLabel(label),
        type,
        section: resolvedSection,
      },
      select: { id: true, label: true, type: true },
    });

    const result = await tx.transaction.updateMany({
      where: { id: { in: transactionIds }, userId, deletedAt: null },
      // Category and transfer are mutually exclusive — see setTransactionCategory.
      data: { categoryId: newCategory.id, transferAccountId: null },
    });
    if (result.count === 0) throw new Error("Transaction not found");

    return newCategory;
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return {
    id: created.id,
    label: created.label,
    // type (not created.type): the value we asked Prisma to write is
    // already the schema-narrowed "INCOME" | "EXPENSE"; created.type comes
    // back typed as the full ItemType because that's the Category model's
    // column type, regardless of what was written.
    type,
    section: sectionLabel(resolvedSection),
  };
}

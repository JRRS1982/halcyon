"use server";

import {
  EXPENSE_BUCKETS,
  INCOME_BUCKETS,
  sectionLabel,
} from "@/lib/categories/buckets";
import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { requireTransactionsEnabled } from "@/lib/settings/server";
import { transactionFingerprint } from "@/lib/transactions/dedupe";
import { type ColumnMapping, mapRows } from "@/lib/transactions/import";
import {
  type LedgerCategory,
  type LedgerPage,
  getTransactionsPage,
} from "@/lib/transactions/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const mappingSchema = z.object({
  dateColumn: z.number().int().min(0),
  amountColumn: z.number().int().min(0),
  descriptionColumn: z.number().int().min(0),
  dateFormat: z.enum(["DMY", "MDY", "YMD"]),
  hasHeader: z.boolean(),
});

const importSchema = z.object({
  accountId: z.string().uuid().nullable(),
  newAccountName: z.string().trim().max(120).nullable(),
  rows: z.array(z.array(z.string())).max(20000),
  mapping: mappingSchema,
});

export type ImportInput = z.input<typeof importSchema>;

export type ImportResult = {
  imported: number;
  duplicates: number;
  invalid: number;
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

export async function importTransactions(
  input: ImportInput,
): Promise<ImportResult> {
  const userId = await requireTransactionsEnabled();
  const { accountId, newAccountName, rows, mapping } =
    importSchema.parse(input);

  const account = await resolveAccount(userId, accountId, newAccountName);

  const mapped = mapRows(rows, mapping as ColumnMapping);
  const valid = mapped.filter(
    (row) => row.errors.length === 0 && row.date && row.amount !== null,
  );
  const invalid = mapped.length - valid.length;

  // Flag rows that already exist for this account (re-uploads / overlaps).
  // Scope the existing lookup to the import's date span so we never load the
  // whole ledger.
  const dates = valid.map((row) => row.date as Date);
  const existingFingerprints = new Set<string>();
  if (dates.length > 0) {
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const existing = await prisma.transaction.findMany({
      where: {
        userId,
        accountId: account.id,
        deletedAt: null,
        date: { gte: min, lte: max },
      },
      select: { date: true, amount: true, description: true },
    });
    for (const tx of existing) {
      existingFingerprints.add(
        transactionFingerprint({
          accountId: account.id,
          date: tx.date,
          amount: Number(tx.amount),
          description: tx.description,
        }),
      );
    }
  }

  const toInsert = valid.filter(
    (row) =>
      !existingFingerprints.has(
        transactionFingerprint({
          accountId: account.id,
          date: row.date as Date,
          amount: row.amount as number,
          description: row.description,
        }),
      ),
  );
  const duplicates = valid.length - toInsert.length;

  if (toInsert.length > 0) {
    await prisma.transaction.createMany({
      data: toInsert.map((row) => ({
        userId,
        accountId: account.id,
        date: row.date as Date,
        amount: row.amount as number,
        description: row.description,
      })),
    });
  }

  // Imported transactions change category actuals on the budget + dashboard,
  // and the ledger on this page.
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return {
    imported: toInsert.length,
    duplicates,
    invalid,
    accountName: account.name,
  };
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
    data: { categoryId },
  });
  if (result.count === 0) throw new Error("Transaction not found");

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

const EXPENSE_BUCKET_VALUES: string[] = EXPENSE_BUCKETS.map((b) => b.value);
const INCOME_BUCKET_VALUES: string[] = INCOME_BUCKETS.map((b) => b.value);

const createCategorySchema = z.object({
  label: z.string().trim().min(1).max(120),
  type: z.enum(["INCOME", "EXPENSE"]),
  // The budget section/bucket this category belongs to, so it can be placed on
  // the budget. Validated against the right set for the type below.
  bucket: z.string().nullable().optional(),
});

// Creates a new category for inline assignment from the ledger. The bucket
// (section) is stored in `category` for expenses or `incomeCategory` for
// income, mirroring how budget line items carry their section.
export async function createCategory(
  input: z.input<typeof createCategorySchema>,
): Promise<LedgerCategory> {
  const userId = await requireTransactionsEnabled();
  const { label, type, bucket } = createCategorySchema.parse(input);

  const expense = type === "EXPENSE";
  const category =
    expense && bucket && EXPENSE_BUCKET_VALUES.includes(bucket)
      ? (bucket as (typeof EXPENSE_BUCKETS)[number]["value"])
      : null;
  const incomeCategory =
    !expense && bucket && INCOME_BUCKET_VALUES.includes(bucket)
      ? (bucket as (typeof INCOME_BUCKETS)[number]["value"])
      : null;

  const created = await prisma.category.create({
    data: { userId, label: cleanLabel(label), type, category, incomeCategory },
    select: { id: true, label: true, type: true },
  });
  revalidatePath("/budget");
  return {
    id: created.id,
    label: created.label,
    type: created.type,
    section: sectionLabel(category ?? incomeCategory),
  };
}

const loadMoreSchema = z.object({
  offset: z.number().int().min(0),
  search: z.string().optional(),
  onlyUncategorized: z.boolean(),
  sortColumn: z
    .enum(["date", "description", "amount", "account", "category"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

// Fetches a page of the ledger for the table (filter / search / sort / paging).
export async function loadMoreTransactions(
  input: z.input<typeof loadMoreSchema>,
): Promise<LedgerPage> {
  const userId = await requireTransactionsEnabled();
  const query = loadMoreSchema.parse(input);
  return getTransactionsPage(userId, query);
}

"use server";

import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { requireTransactionsEnabled } from "@/lib/settings/server";
import { transactionFingerprint } from "@/lib/transactions/dedupe";
import { type ColumnMapping, mapRows } from "@/lib/transactions/import";
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

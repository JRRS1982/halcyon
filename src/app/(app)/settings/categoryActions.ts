"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bucketFields } from "@/lib/categories/buckets";
import { planItemMerge } from "@/lib/categories/merge";
import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Categories are managed in Settings and exist regardless of the transactions
// feature, so these gate on auth only (not requireTransactionsEnabled).
async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

// Budget + dashboard read categories/actuals; settings renders the list.
function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/budget");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

const upsertSchema = z.object({
  label: z.string().trim().min(1).max(120),
  type: z.enum(["INCOME", "EXPENSE"]),
  bucket: z.string().nullable().optional(),
});

export async function createManagedCategory(
  input: z.input<typeof upsertSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { label, type, bucket } = upsertSchema.parse(input);
  await prisma.category.create({
    data: {
      userId,
      label: cleanLabel(label),
      type,
      ...bucketFields(type, bucket),
    },
  });
  revalidateAll();
}

const updateSchema = upsertSchema.extend({ categoryId: z.string().uuid() });

export async function updateCategory(
  input: z.input<typeof updateSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { categoryId, label, type, bucket } = updateSchema.parse(input);
  const result = await prisma.category.updateMany({
    where: { id: categoryId, userId, deletedAt: null },
    data: { label: cleanLabel(label), type, ...bucketFields(type, bucket) },
  });
  if (result.count === 0) throw new Error("Category not found");
  revalidateAll();
}

const idSchema = z.object({ categoryId: z.string().uuid() });

// Soft-delete: removed from pickers + the list, but transactions keep their
// link so historical budget actuals still compute.
export async function deleteCategory(
  input: z.input<typeof idSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { categoryId } = idSchema.parse(input);
  const result = await prisma.category.updateMany({
    where: { id: categoryId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Category not found");
  revalidateAll();
}

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  survivorId: z.string().uuid(),
});

// Folds `source` into `survivor`: repoint its transactions and budget rows,
// combining budgets where both have a row in the same month (see planItemMerge),
// then soft-delete the source. Runs in one transaction.
export async function mergeCategories(
  input: z.input<typeof mergeSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { sourceId, survivorId } = mergeSchema.parse(input);
  if (sourceId === survivorId) {
    throw new Error("Choose a different category to merge into");
  }

  const [source, survivor] = await Promise.all([
    prisma.category.findFirst({
      where: { id: sourceId, userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: { id: survivorId, userId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!source || !survivor) throw new Error("Category not found");

  const [sourceItems, survivorItems] = await Promise.all([
    prisma.financialItem.findMany({
      where: { categoryId: sourceId, deletedAt: null },
      select: { id: true, periodId: true, budget: true },
    }),
    prisma.financialItem.findMany({
      where: { categoryId: survivorId, deletedAt: null },
      select: { id: true, periodId: true },
    }),
  ]);

  const survivorByPeriod: Record<string, string> = {};
  for (const item of survivorItems) survivorByPeriod[item.periodId] = item.id;

  const plan = planItemMerge(
    sourceItems.map((i) => ({
      id: i.id,
      periodId: i.periodId,
      budget: Number(i.budget),
    })),
    survivorByPeriod,
  );

  const now = new Date();
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { userId, categoryId: sourceId },
      data: { categoryId: survivorId },
    }),
    ...(plan.repointIds.length > 0
      ? [
          prisma.financialItem.updateMany({
            where: { id: { in: plan.repointIds } },
            data: { categoryId: survivorId },
          }),
        ]
      : []),
    ...plan.combine.map((c) =>
      prisma.financialItem.update({
        where: { id: c.survivorItemId },
        data: { budget: { increment: c.addBudget } },
      }),
    ),
    ...(plan.deleteIds.length > 0
      ? [
          prisma.financialItem.updateMany({
            where: { id: { in: plan.deleteIds } },
            data: { deletedAt: now },
          }),
        ]
      : []),
    prisma.category.update({
      where: { id: sourceId },
      data: { deletedAt: now },
    }),
  ]);

  revalidateAll();
}

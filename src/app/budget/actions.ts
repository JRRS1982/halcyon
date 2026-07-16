"use server";

import { randomUUID } from "node:crypto";
import { buildCopiedItems } from "@/lib/budget/copyPeriod";
import { currentMonthRange, monthRangeFor } from "@/lib/budget/period";
import {
  type CopyBudgetTemplateInput,
  type CopyPeriodFromInput,
  type CreateItemInput,
  type DeleteItemInput,
  type SaveBudgetTemplateInput,
  type UpdateItemInput,
  copyBudgetTemplateSchema,
  copyPeriodFromSchema,
  createItemSchema,
  deleteItemSchema,
  saveBudgetTemplateSchema,
  updateItemSchema,
} from "@/lib/budget/schemas";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { FinancialItem } from "@prisma/client";
import { redirect } from "next/navigation";

// Prisma `Decimal` can't cross the server→client boundary (it serialises to
// `{}`); the budget sheet consumes budget/actual as numbers (`SerializedItem`),
// so coerce them before returning a mutated item to the client.
function toClientItem(item: FinancialItem) {
  return { ...item, budget: Number(item.budget), actual: Number(item.actual) };
}

// Gates every server action on a valid signed-in user. The middleware also
// guards /budget, but every action enforces auth independently — never trust
// a single layer.
async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/budget");
  }
  return user.id;
}

// Returns the user's FinancialPeriod for the current calendar month;
// creates it if it doesn't exist yet. Idempotent — safe to call on every
// /budget visit.
export async function ensureCurrentPeriod() {
  const now = currentMonthRange();
  return ensurePeriodForMonthInternal(now.startDate, now.endDate, now.label);
}

// Returns the user's FinancialPeriod for (year, month) — month 0-indexed.
// Creates it if missing. Used by the toolbar stepper / picker to navigate
// between periods (including ones that haven't been visited yet).
export async function ensurePeriodForMonth(year: number, month: number) {
  const range = monthRangeFor(year, month);
  return ensurePeriodForMonthInternal(
    range.startDate,
    range.endDate,
    range.label,
  );
}

// Shared implementation. Pulled out so the public actions stay declarative.
async function ensurePeriodForMonthInternal(
  startDate: Date,
  endDate: Date,
  label: string,
) {
  const userId = await requireUserId();

  const existing = await prisma.financialPeriod.findUnique({
    where: {
      userId_granularity_startDate: {
        userId,
        granularity: "MONTH",
        startDate,
      },
    },
  });
  if (existing) return existing;

  return prisma.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate,
      endDate,
      label,
    },
  });
}

export async function createItem(input: CreateItemInput) {
  const userId = await requireUserId();
  const parsed = createItemSchema.parse(input);

  // Verify the period belongs to this user. Server-side Prisma bypasses RLS
  // so app-level userId scoping is the boundary.
  const period = await prisma.financialPeriod.findFirst({
    where: { id: parsed.periodId, userId, deletedAt: null },
  });
  if (!period) {
    throw new Error("Period not found");
  }

  // New row's sortOrder = max(sortOrder) + 1 within (periodId, type).
  const last = await prisma.financialItem.findFirst({
    where: {
      periodId: parsed.periodId,
      type: parsed.type,
      deletedAt: null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  // Income rows get an incomeCategory; expense rows get a category.
  const category =
    parsed.type === "EXPENSE" ? (parsed.category ?? "FIXED") : null;
  const incomeCategory =
    parsed.type === "INCOME" ? (parsed.incomeCategory ?? "OTHER") : null;

  return toClientItem(
    await prisma.financialItem.create({
      data: {
        periodId: parsed.periodId,
        type: parsed.type,
        category,
        incomeCategory,
        label: parsed.label,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    }),
  );
}

export async function updateItem(input: UpdateItemInput) {
  const userId = await requireUserId();
  const parsed = updateItemSchema.parse(input);

  const item = await prisma.financialItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  // Category changes only make sense on the matching side.
  if (parsed.category !== undefined && item.type !== "EXPENSE") {
    throw new Error("Only expense rows have a category");
  }
  if (parsed.incomeCategory !== undefined && item.type !== "INCOME") {
    throw new Error("Only income rows have an income category");
  }

  return toClientItem(
    await prisma.financialItem.update({
      where: { id: parsed.itemId },
      data: {
        ...(parsed.label !== undefined && { label: parsed.label }),
        ...(parsed.budget !== undefined && { budget: parsed.budget }),
        ...(parsed.actual !== undefined && { actual: parsed.actual }),
        ...(parsed.category !== undefined && { category: parsed.category }),
        ...(parsed.incomeCategory !== undefined && {
          incomeCategory: parsed.incomeCategory,
        }),
      },
    }),
  );
}

// Soft-delete an item.
export async function deleteItem(input: DeleteItemInput) {
  const userId = await requireUserId();
  const parsed = deleteItemSchema.parse(input);

  const item = await prisma.financialItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  await prisma.financialItem.update({
    where: { id: parsed.itemId },
    data: { deletedAt: new Date() },
  });
}

// The user's periods that have at least one item — the candidate sources for
// "Copy from…". Newest first. Virtual (never-saved) months have no row and so
// never appear, which is what we want — there's nothing to copy from them.
export async function listCopyablePeriods() {
  const userId = await requireUserId();

  const periods = await prisma.financialPeriod.findMany({
    where: {
      userId,
      deletedAt: null,
      items: { some: { deletedAt: null } },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true },
  });

  return periods.map((p) => ({ id: p.id, label: p.label }));
}

// Replace the target month's budget rows with a copy of the source period's:
// the full item hierarchy and budgeted amounts carry over, actuals reset to 0.
// The target period is created on the fly if it was still virtual. Existing
// target rows are soft-deleted in the same transaction so the copy is an
// atomic overwrite. Returns the new item list so the client can swap state
// without a refetch.
export async function copyPeriodFrom(input: CopyPeriodFromInput) {
  const userId = await requireUserId();
  const parsed = copyPeriodFromSchema.parse(input);

  const source = await prisma.financialPeriod.findFirst({
    where: { id: parsed.sourcePeriodId, userId, deletedAt: null },
  });
  if (!source) {
    throw new Error("Source period not found");
  }

  const range = monthRangeFor(parsed.targetYear, parsed.targetMonth);
  const target = await ensurePeriodForMonthInternal(
    range.startDate,
    range.endDate,
    range.label,
  );

  if (target.id === source.id) {
    throw new Error("Cannot copy a period onto itself");
  }

  const sourceItems = await prisma.financialItem.findMany({
    where: { periodId: source.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      category: true,
      incomeCategory: true,
      label: true,
      budget: true,
      sortOrder: true,
    },
  });

  const copied = buildCopiedItems(
    sourceItems.map((it) => ({ ...it, budget: Number(it.budget) })),
    randomUUID,
  );

  await prisma.$transaction([
    prisma.financialItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.financialItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        periodId: target.id,
        type: it.type,
        category: it.category,
        incomeCategory: it.incomeCategory,
        label: it.label,
        budget: it.budget,
        actual: it.actual,
        sortOrder: it.sortOrder,
      })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

// Snapshot a month's rows into the user's reusable budget template, replacing
// whatever was there. Hierarchy and budgets carry over (via buildCopiedItems);
// actuals are dropped — a template is the plan, not spending.
export async function saveBudgetTemplate(input: SaveBudgetTemplateInput) {
  const userId = await requireUserId();
  const parsed = saveBudgetTemplateSchema.parse(input);

  const period = await prisma.financialPeriod.findFirst({
    where: { id: parsed.sourcePeriodId, userId, deletedAt: null },
  });
  if (!period) {
    throw new Error("Source period not found");
  }

  const sourceItems = await prisma.financialItem.findMany({
    where: { periodId: period.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      category: true,
      incomeCategory: true,
      label: true,
      budget: true,
      sortOrder: true,
    },
  });

  const copied = buildCopiedItems(
    sourceItems.map((it) => ({ ...it, budget: Number(it.budget) })),
    randomUUID,
  );

  await prisma.$transaction([
    prisma.budgetTemplateItem.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.budgetTemplateItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        userId,
        type: it.type,
        category: it.category,
        incomeCategory: it.incomeCategory,
        label: it.label,
        budget: it.budget,
        sortOrder: it.sortOrder,
      })),
    }),
  ]);

  return { count: copied.length };
}

// Seed a month from the user's budget template, replacing the month's rows.
// Mirror of copyPeriodFrom but the source is the template, not a period.
export async function copyBudgetTemplateInto(input: CopyBudgetTemplateInput) {
  const userId = await requireUserId();
  const parsed = copyBudgetTemplateSchema.parse(input);

  const templateItems = await prisma.budgetTemplateItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      category: true,
      incomeCategory: true,
      label: true,
      budget: true,
      sortOrder: true,
    },
  });
  if (templateItems.length === 0) {
    throw new Error("No budget template saved yet");
  }

  const range = monthRangeFor(parsed.targetYear, parsed.targetMonth);
  const target = await ensurePeriodForMonthInternal(
    range.startDate,
    range.endDate,
    range.label,
  );

  const copied = buildCopiedItems(
    templateItems.map((it) => ({ ...it, budget: Number(it.budget) })),
    randomUUID,
  );

  await prisma.$transaction([
    prisma.financialItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.financialItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        periodId: target.id,
        type: it.type,
        category: it.category,
        incomeCategory: it.incomeCategory,
        label: it.label,
        budget: it.budget,
        actual: it.actual,
        sortOrder: it.sortOrder,
      })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

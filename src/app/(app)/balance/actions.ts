"use server";

import { randomUUID } from "node:crypto";
import type { BalanceItem } from "@prisma/client";
import { redirect } from "next/navigation";
import { computeMove } from "@/lib/balance/reorder";
import {
  type CopyBalancePeriodFromInput,
  type CopyBalanceTemplateInput,
  type CreateBalanceItemForMonthInput,
  copyBalancePeriodFromSchema,
  copyBalanceTemplateSchema,
  createBalanceItemForMonthSchema,
  type DeleteBalanceItemInput,
  deleteBalanceItemSchema,
  type MoveBalanceItemInput,
  moveBalanceItemSchema,
  type SaveBalanceTemplateInput,
  type SetBalanceItemSectionInput,
  saveBalanceTemplateSchema,
  setBalanceItemSectionSchema,
  type UpdateBalanceItemInput,
  updateBalanceItemSchema,
} from "@/lib/balance/schemas";
import { ensurePeriodForMonthIn } from "@/lib/budget/ensurePeriod";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensurePeriodForMonth } from "../budget/actions";

// Prisma `Decimal` can't cross the server→client boundary (it serialises to
// `{}`); the balance sheet consumes value as a number, so coerce it before
// returning a mutated item to the client. Mirrors budget/actions.ts.
function toClientItem(item: BalanceItem) {
  return { ...item, value: Number(item.value) };
}

// Mirrors the auth gate in src/app/budget/actions.ts — every action enforces
// auth independently. Middleware also guards /balance but we never trust a
// single layer.
async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/balance");
  }
  return user.id;
}

// Adds a row to a month, creating that month's FinancialPeriod if this is the
// first row in it.
//
// One action rather than ensurePeriodForMonth followed by createBalanceItem:
// those ran as two requests from the sheet, so navigating between them left a
// period row with nothing in it — a month that looks visited but is empty.
export async function createBalanceItemForMonth(
  input: CreateBalanceItemForMonthInput,
) {
  const userId = await requireUserId();
  const parsed = createBalanceItemForMonthSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  return prisma.$transaction(async (tx) => {
    const period = await ensurePeriodForMonthIn(tx, userId, range);

    // sortOrder appends at the end of the (period, type, category) bucket.
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

    const item = await tx.balanceItem.create({
      data: {
        periodId: period.id,
        type: parsed.type,
        category: parsed.category,
        label: parsed.label,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return { periodId: period.id, item: toClientItem(item) };
  });
}

export async function updateBalanceItem(input: UpdateBalanceItemInput) {
  const userId = await requireUserId();
  const parsed = updateBalanceItemSchema.parse(input);

  const item = await prisma.balanceItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  return toClientItem(
    await prisma.balanceItem.update({
      where: { id: parsed.itemId },
      data: {
        ...(parsed.label !== undefined && { label: parsed.label }),
        // Editing the value is what confirms a carried-over number as this
        // month's — label or notes edits leave the flag alone.
        ...(parsed.value !== undefined && {
          value: parsed.value,
          carriedOver: false,
        }),
        ...(parsed.notes !== undefined && { notes: parsed.notes }),
      },
    }),
  );
}

// Move an item one slot up or down, crossing category / type boundaries
// (Current → Long-term → Other → Liabilities …) one step at a time. The
// ordering logic is shared with the client via computeMove; here it runs
// against the authoritative DB rows and persists only what changed.
export async function moveBalanceItem(input: MoveBalanceItemInput) {
  const userId = await requireUserId();
  const parsed = moveBalanceItemSchema.parse(input);

  const item = await prisma.balanceItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  const siblings = await prisma.balanceItem.findMany({
    where: { periodId: item.periodId, deletedAt: null },
    select: { id: true, type: true, category: true, sortOrder: true },
  });

  const moved = computeMove(siblings, parsed.itemId, parsed.direction);
  if (!moved) return; // already at the extreme — no-op

  // Persist only rows whose type / category / sortOrder actually changed.
  const before = new Map(siblings.map((s) => [s.id, s]));
  const changed = moved.filter((m) => {
    const b = before.get(m.id);
    return (
      b &&
      (b.type !== m.type ||
        b.category !== m.category ||
        b.sortOrder !== m.sortOrder)
    );
  });

  await prisma.$transaction(
    changed.map((c) =>
      prisma.balanceItem.update({
        where: { id: c.id },
        data: { type: c.type, category: c.category, sortOrder: c.sortOrder },
      }),
    ),
  );
}

// Move an item directly into a chosen (type, category) section, appending it
// to the end of that bucket. Unlike moveBalanceItem this jumps to any section
// in one step; the new sortOrder is computed the same way createBalanceItem
// appends a fresh row.
export async function setBalanceItemSection(input: SetBalanceItemSectionInput) {
  const userId = await requireUserId();
  const parsed = setBalanceItemSectionSchema.parse(input);

  const item = await prisma.balanceItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  if (item.type === parsed.type && item.category === parsed.category) {
    return toClientItem(item);
  }

  const last = await prisma.balanceItem.findFirst({
    where: {
      periodId: item.periodId,
      type: parsed.type,
      category: parsed.category,
      deletedAt: null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return toClientItem(
    await prisma.balanceItem.update({
      where: { id: parsed.itemId },
      data: {
        type: parsed.type,
        category: parsed.category,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    }),
  );
}

// Soft-delete a single balance item. No descendants — balance rows are flat.
export async function deleteBalanceItem(input: DeleteBalanceItemInput) {
  const userId = await requireUserId();
  const parsed = deleteBalanceItemSchema.parse(input);

  const item = await prisma.balanceItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  await prisma.balanceItem.update({
    where: { id: parsed.itemId },
    data: { deletedAt: new Date() },
  });
}

// The user's periods that have at least one balance item — the candidate
// sources for "Copy from…" on the balance sheet. Newest first.
export async function listCopyableBalancePeriods() {
  const userId = await requireUserId();

  const periods = await prisma.financialPeriod.findMany({
    where: {
      userId,
      deletedAt: null,
      balanceItems: { some: { deletedAt: null } },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true },
  });

  return periods.map((p) => ({ id: p.id, label: p.label }));
}

// Replace the target month's balance rows with a copy of the source period's.
// Balance rows are flat (no hierarchy) and carry a single value, so the whole
// line — type, category, label, value and notes — copies over as a starting
// point the user then adjusts. The target period is created on the fly if it
// was still virtual; existing target rows are soft-deleted in the same
// transaction so the copy is an atomic overwrite. Returns the new item list
// so the client can swap state without a refetch.
export async function copyBalancePeriodFrom(input: CopyBalancePeriodFromInput) {
  const userId = await requireUserId();
  const parsed = copyBalancePeriodFromSchema.parse(input);

  const source = await prisma.financialPeriod.findFirst({
    where: { id: parsed.sourcePeriodId, userId, deletedAt: null },
  });
  if (!source) {
    throw new Error("Source period not found");
  }

  const target = await ensurePeriodForMonth(
    parsed.targetYear,
    parsed.targetMonth,
  );

  if (target.id === source.id) {
    throw new Error("Cannot copy a period onto itself");
  }

  const sourceItems = await prisma.balanceItem.findMany({
    where: { periodId: source.id, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      type: true,
      category: true,
      label: true,
      value: true,
      notes: true,
      sortOrder: true,
    },
  });

  const copied = sourceItems.map((it) => ({
    id: randomUUID(),
    type: it.type,
    category: it.category,
    label: it.label,
    value: Number(it.value),
    notes: it.notes,
    sortOrder: it.sortOrder,
    // The clone holds a number the user hasn't confirmed for this month yet.
    carriedOver: true,
  }));

  await prisma.$transaction([
    prisma.balanceItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.balanceItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        periodId: target.id,
        type: it.type,
        category: it.category,
        label: it.label,
        value: it.value,
        notes: it.notes,
        sortOrder: it.sortOrder,
        carriedOver: it.carriedOver,
      })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

// Snapshot a month's balance rows into the user's reusable balance template,
// replacing whatever was there. Balance rows are flat, so this is a straight
// copy of type/category/label/value/notes.
export async function saveBalanceTemplate(input: SaveBalanceTemplateInput) {
  const userId = await requireUserId();
  const parsed = saveBalanceTemplateSchema.parse(input);

  const period = await prisma.financialPeriod.findFirst({
    where: { id: parsed.sourcePeriodId, userId, deletedAt: null },
  });
  if (!period) {
    throw new Error("Source period not found");
  }

  const sourceItems = await prisma.balanceItem.findMany({
    where: { periodId: period.id, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      type: true,
      category: true,
      label: true,
      value: true,
      notes: true,
      sortOrder: true,
    },
  });

  const rows = sourceItems.map((it) => ({
    id: randomUUID(),
    userId,
    type: it.type,
    category: it.category,
    label: it.label,
    value: Number(it.value),
    notes: it.notes,
    sortOrder: it.sortOrder,
  }));

  await prisma.$transaction([
    prisma.balanceTemplateItem.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.balanceTemplateItem.createMany({ data: rows }),
  ]);

  return { count: rows.length };
}

// Seed a month from the user's balance template, replacing the month's rows.
// Mirror of copyBalancePeriodFrom but the source is the template.
export async function copyBalanceTemplateInto(input: CopyBalanceTemplateInput) {
  const userId = await requireUserId();
  const parsed = copyBalanceTemplateSchema.parse(input);

  const templateItems = await prisma.balanceTemplateItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      type: true,
      category: true,
      label: true,
      value: true,
      notes: true,
      sortOrder: true,
    },
  });
  if (templateItems.length === 0) {
    throw new Error("No balance template saved yet");
  }

  const target = await ensurePeriodForMonth(
    parsed.targetYear,
    parsed.targetMonth,
  );

  const copied = templateItems.map((it) => ({
    id: randomUUID(),
    type: it.type,
    category: it.category,
    label: it.label,
    value: Number(it.value),
    notes: it.notes,
    sortOrder: it.sortOrder,
    // The clone holds a number the user hasn't confirmed for this month yet.
    carriedOver: true,
  }));

  await prisma.$transaction([
    prisma.balanceItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.balanceItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        periodId: target.id,
        type: it.type,
        category: it.category,
        label: it.label,
        value: it.value,
        notes: it.notes,
        sortOrder: it.sortOrder,
        carriedOver: it.carriedOver,
      })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

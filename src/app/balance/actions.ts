"use server";

import { randomUUID } from "node:crypto";
import { computeMove } from "@/lib/balance/reorder";
import {
  type CopyBalancePeriodFromInput,
  type CreateBalanceItemInput,
  type DeleteBalanceItemInput,
  type MoveBalanceItemInput,
  type SetBalanceItemSectionInput,
  type UpdateBalanceItemInput,
  copyBalancePeriodFromSchema,
  createBalanceItemSchema,
  deleteBalanceItemSchema,
  moveBalanceItemSchema,
  setBalanceItemSectionSchema,
  updateBalanceItemSchema,
} from "@/lib/balance/schemas";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensurePeriodForMonth } from "../budget/actions";

// Mirrors the auth gate in src/app/budget/actions.ts — every action enforces
// auth independently. Middleware also guards /balance but we never trust a
// single layer.
async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/balance");
  }
  return user.id;
}

export async function createBalanceItem(input: CreateBalanceItemInput) {
  const userId = await requireUserId();
  const parsed = createBalanceItemSchema.parse(input);

  // Verify the period belongs to this user. Server-side Prisma bypasses RLS
  // so app-level userId scoping is the boundary.
  const period = await prisma.financialPeriod.findFirst({
    where: { id: parsed.periodId, userId, deletedAt: null },
  });
  if (!period) {
    throw new Error("Period not found");
  }

  // sortOrder appends at the end of the (period, type, category) bucket.
  const last = await prisma.balanceItem.findFirst({
    where: {
      periodId: parsed.periodId,
      type: parsed.type,
      category: parsed.category,
      deletedAt: null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.balanceItem.create({
    data: {
      periodId: parsed.periodId,
      type: parsed.type,
      category: parsed.category,
      label: parsed.label,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
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

  return prisma.balanceItem.update({
    where: { id: parsed.itemId },
    data: {
      ...(parsed.label !== undefined && { label: parsed.label }),
      ...(parsed.value !== undefined && { value: parsed.value }),
      ...(parsed.notes !== undefined && { notes: parsed.notes }),
    },
  });
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
    return item;
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

  return prisma.balanceItem.update({
    where: { id: parsed.itemId },
    data: {
      type: parsed.type,
      category: parsed.category,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
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
      })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

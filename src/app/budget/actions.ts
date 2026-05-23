"use server";

import { currentMonthRange, monthRangeFor } from "@/lib/budget/period";
import {
  type CreateItemInput,
  type DeleteItemInput,
  type ReparentItemInput,
  type UpdateItemInput,
  createItemSchema,
  deleteItemSchema,
  reparentItemSchema,
  updateItemSchema,
} from "@/lib/budget/schemas";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Gates every server action on a valid signed-in user. The middleware also
// guards /budget, but every action enforces auth independently — never trust
// a single layer.
async function requireUserId(): Promise<string> {
  const supabase = createClient();
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

  // If parentItemId provided, verify it belongs to the same period and isn't
  // already at the depth-3 cap.
  if (parsed.parentItemId) {
    const parent = await prisma.financialItem.findFirst({
      where: {
        id: parsed.parentItemId,
        periodId: parsed.periodId,
        deletedAt: null,
      },
    });
    if (!parent) {
      throw new Error("Parent item not found");
    }
    if (parent.type !== parsed.type) {
      throw new Error("Sub-row type must match parent");
    }
    const depth = await depthOf(parsed.parentItemId);
    if (depth >= 3) {
      throw new Error("Maximum depth reached");
    }
  }

  // New row's sortOrder = max(sortOrder) + 1 within (periodId, type, parentItemId).
  const last = await prisma.financialItem.findFirst({
    where: {
      periodId: parsed.periodId,
      type: parsed.type,
      parentItemId: parsed.parentItemId,
      deletedAt: null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.financialItem.create({
    data: {
      periodId: parsed.periodId,
      type: parsed.type,
      parentItemId: parsed.parentItemId,
      label: parsed.label,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
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

  return prisma.financialItem.update({
    where: { id: parsed.itemId },
    data: {
      ...(parsed.label !== undefined && { label: parsed.label }),
      ...(parsed.budget !== undefined && { budget: parsed.budget }),
      ...(parsed.actual !== undefined && { actual: parsed.actual }),
    },
  });
}

// Soft-delete an item and all its descendants atomically.
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

  await prisma.$transaction(async (tx) => {
    const descendants = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE d AS (
        SELECT id FROM "FinancialItem" WHERE id = ${parsed.itemId}::uuid
        UNION
        SELECT c.id FROM "FinancialItem" c JOIN d ON c."parentItemId" = d.id
      )
      SELECT id FROM d
    `;
    const ids = descendants.map((r) => r.id);
    await tx.financialItem.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  });
}

// Re-attach an item to a new parent (or to the top level when newParentItemId
// is null). The client uses this for the Indent / Outdent toolbar actions.
// Enforces: same-period, same-type, no cycle, depth-3 cap for the item's
// entire subtree. New sortOrder appends at the end of the destination
// scope's children.
export async function reparentItem(input: ReparentItemInput) {
  const userId = await requireUserId();
  const parsed = reparentItemSchema.parse(input);

  const item = await prisma.financialItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  let newParentDepth = 0;

  if (parsed.newParentItemId !== null) {
    const newParent = await prisma.financialItem.findFirst({
      where: {
        id: parsed.newParentItemId,
        periodId: item.periodId,
        type: item.type,
        deletedAt: null,
      },
    });
    if (!newParent) {
      throw new Error("New parent not found");
    }

    // Cycle check — walk up newParent's ancestry; if itemId appears, reject.
    let ancestorId: string | null = newParent.parentItemId;
    while (ancestorId !== null) {
      if (ancestorId === parsed.itemId) {
        throw new Error("Cannot move item under one of its own descendants");
      }
      const ancestor: { parentItemId: string | null } | null =
        await prisma.financialItem.findFirst({
          where: { id: ancestorId },
          select: { parentItemId: true },
        });
      if (!ancestor) break;
      ancestorId = ancestor.parentItemId;
    }

    newParentDepth = await depthOf(newParent.id);
  }

  // Depth cap. newParentDepth = 0 when reparenting to top level.
  // Deepest descendant after move = newParentDepth + 1 + subtreeMaxDepth(item).
  const subtreeDepth = await subtreeMaxDepth(parsed.itemId);
  if (newParentDepth + 1 + subtreeDepth > 3) {
    throw new Error("Move would exceed the depth-3 cap");
  }

  const last = await prisma.financialItem.findFirst({
    where: {
      periodId: item.periodId,
      type: item.type,
      parentItemId: parsed.newParentItemId,
      deletedAt: null,
      NOT: { id: parsed.itemId },
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.financialItem.update({
    where: { id: parsed.itemId },
    data: {
      parentItemId: parsed.newParentItemId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

// Walk up the parent chain to find the depth of a given item. depth 1 = top
// level. Returns 4+ for anything beyond depth 3 (which will fail the cap
// check in createItem / reparentItem).
async function depthOf(itemId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = itemId;
  while (currentId !== null && depth <= 5) {
    const row: { parentItemId: string | null } | null =
      await prisma.financialItem.findFirst({
        where: { id: currentId },
        select: { parentItemId: true },
      });
    if (!row || row.parentItemId === null) break;
    currentId = row.parentItemId;
    depth++;
  }
  return depth;
}

// Returns the maximum depth of descendants below itemId (the item itself is
// depth 0). Used by reparentItem to enforce the depth-3 cap across a moved
// subtree.
async function subtreeMaxDepth(itemId: string): Promise<number> {
  const result = await prisma.$queryRaw<{ max_depth: number }[]>`
    WITH RECURSIVE d AS (
      SELECT id, 0::int AS depth
      FROM "FinancialItem"
      WHERE id = ${itemId}::uuid AND "deletedAt" IS NULL
      UNION ALL
      SELECT c.id, d.depth + 1
      FROM "FinancialItem" c
      JOIN d ON c."parentItemId" = d.id
      WHERE c."deletedAt" IS NULL
    )
    SELECT COALESCE(MAX(depth), 0)::int AS max_depth FROM d
  `;
  return result[0]?.max_depth ?? 0;
}

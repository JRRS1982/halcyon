"use server";

import {
  type CreateBalanceItemInput,
  type DeleteBalanceItemInput,
  type UpdateBalanceItemInput,
  createBalanceItemSchema,
  deleteBalanceItemSchema,
  updateBalanceItemSchema,
} from "@/lib/balance/schemas";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

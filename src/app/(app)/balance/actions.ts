"use server";

import type { BalanceItem } from "@prisma/client";
import { redirect } from "next/navigation";
import { kindOf } from "@/lib/accounts/accountDraft";
import { toCarriedOverRows } from "@/lib/balance/copyRows";
import {
  type ClearBalanceValueInput,
  type CopyBalancePeriodFromInput,
  clearBalanceValueSchema,
  copyBalancePeriodFromSchema,
  type UpsertBalanceValueInput,
  upsertBalanceValueSchema,
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

// Keyed by (account, month) rather than by item id: the account is the
// durable thing the user is naming a value for, so the same gesture that
// created last month's row also updates this month's — never a second row
// for the same account in the same period. BalanceItem's partial unique
// index on live (periodId, accountId) rows means Prisma's own upsert() can't
// target this, hence the explicit find-then-write.
export async function upsertBalanceValue(input: UpsertBalanceValueInput) {
  const userId = await requireUserId();
  const parsed = upsertBalanceValueSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  const item = await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: parsed.accountId, userId, deletedAt: null },
    });
    if (!account) throw new Error("Account not found");

    const period = await ensurePeriodForMonthIn(tx, userId, range);

    const existing = await tx.balanceItem.findFirst({
      where: { periodId: period.id, accountId: account.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return tx.balanceItem.update({
        where: { id: existing.id },
        data: {
          // Editing the value is what confirms a carried-over number as this
          // month's — a notes-only edit leaves the flag alone.
          ...(parsed.value !== undefined && {
            value: parsed.value,
            carriedOver: false,
          }),
          ...(parsed.notes !== undefined && { notes: parsed.notes }),
        },
      });
    }

    // A note describes this month's figure, so it needs one to describe.
    // Without this, a notes-only edit on a month the account has never been
    // observed in would invent a £0 the user never typed — and quietly move
    // the account out of the "without a value" count on the sheet.
    if (parsed.value === undefined) {
      throw new Error(
        "Enter a value first — a note describes this month's figure",
      );
    }

    return tx.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: kindOf(account.type),
        category: account.section,
        label: account.name,
        value: parsed.value,
        notes: parsed.notes ?? null,
        sortOrder: account.sortOrder,
      },
    });
  });

  return toClientItem(item);
}

// Soft-deletes this month's live row(s) for the account. A no-op if the
// account has never been observed this month — there's nothing to clear.
export async function clearBalanceValue(
  input: ClearBalanceValueInput,
): Promise<void> {
  const userId = await requireUserId();
  const parsed = clearBalanceValueSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  const account = await prisma.account.findFirst({
    where: { id: parsed.accountId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new Error("Account not found");

  await prisma.balanceItem.updateMany({
    where: {
      accountId: account.id,
      deletedAt: null,
      period: { userId, granularity: "MONTH", startDate: range.startDate },
    },
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
    where: {
      periodId: source.id,
      deletedAt: null,
      // A row backed by an archived account must not carry over into a new
      // month — that's the whole point of archiving. accountId is required
      // now (Task 1-3's migration deleted the legacy null-accountId rows
      // this used to also let through), so every live row has an account to
      // check.
      account: { deletedAt: null },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      type: true,
      category: true,
      label: true,
      value: true,
      notes: true,
      sortOrder: true,
      accountId: true,
    },
  });

  const copied = toCarriedOverRows(sourceItems);

  await prisma.$transaction([
    prisma.balanceItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.balanceItem.createMany({
      data: copied.map((it) => ({ ...it, periodId: target.id })),
    }),
  ]);

  return { periodId: target.id, items: copied };
}

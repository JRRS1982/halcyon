"use server";

import { randomUUID } from "node:crypto";
import type {
  BudgetItem,
  CategorySection,
  ItemType,
  Prisma,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { assertAnchorMatches, requiredAnchorKind } from "@/lib/budget/anchors";
import {
  buildCopiedItems,
  type CopiedItem,
  type CopyableItem,
} from "@/lib/budget/copyPeriod";
import { ensurePeriodForMonthIn } from "@/lib/budget/ensurePeriod";
import { currentMonthRange, monthRangeFor } from "@/lib/budget/period";
import {
  type CopyPeriodFromInput,
  type CreateItemForMonthInput,
  copyPeriodFromSchema,
  createItemForMonthSchema,
  type DeleteItemInput,
  deleteItemSchema,
  type UpdateItemInput,
  updateItemSchema,
} from "@/lib/budget/schemas";
import { sectionFor } from "@/lib/categories/sections";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  accountActual,
  isAccountKeyed,
  netActual,
} from "@/lib/transactions/actual";
import {
  getAmountsByCategory,
  getTransferFlowByAccount,
} from "@/lib/transactions/server";

// Prisma `Decimal` can't cross the server→client boundary (it serialises to
// `{}`); the budget sheet consumes budget/actual as numbers (`SerializedItem`),
// so coerce them before returning a mutated item to the client.
function toClientItem(item: BudgetItem) {
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
//
// Takes the Prisma client rather than closing over the global one, so callers
// that need the period and something else to succeed or fail together can pass
// a transaction client — see createItemForMonth.
async function ensurePeriodForMonthInternal(
  startDate: Date,
  endDate: Date,
  label: string,
) {
  const userId = await requireUserId();
  return ensurePeriodForMonthIn(prisma, userId, { startDate, endDate, label });
}

// accountId arrives from the client. Confirm the caller owns it AND that its
// kind matches the row's type — a TRANSFER funds an asset, a REPAYMENT pays a
// liability. Without the ownership half this is the Critical P1 shipped: an id
// used in a write without checking who it belongs to. Per ADR-002 the Prisma
// role bypasses RLS, so this filter is the only fence, not a second one.
//
// Zod (createItemForMonthSchema) has already established that an accountId is
// present exactly for the two anchored kinds; this is the half that needs a
// database read.
async function requireAnchorAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  type: ItemType,
  accountId: string,
): Promise<void> {
  const account = await tx.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { kind: true },
  });
  if (!account) {
    throw new Error("Account not found");
  }

  assertAnchorMatches(type, account.kind);
}

// One account carries at most one row per period.
//
// getTransferFlowByAccount yields one net per account, so two rows on the same
// account cannot be told apart: each would render the whole figure and its
// section would count it twice — "Mortgage payment" plus "Overpayment" would
// double the month's Expenses actual. Splitting the net across rows or showing
// it on one of them was considered and rejected: with one figure per account
// the rows are genuinely indistinguishable, so permitting only one is the
// honest model.
//
// The Add drawer filters its picker on the same rule, but this is the fence —
// the picker is a convenience and can be bypassed.
//
// Not a database unique index on (periodId, accountId): a soft-deleted
// BudgetItem keeps its accountId, so the constraint would reject a legitimate
// re-add after a delete. Clearing the link on delete would fix that and needs
// a migration; it is disproportionate here.
//
// Residual race, accepted: two creates in flight at once can both read no
// existing row and both write. It needs the same user submitting the same
// gesture twice in the same instant, and the outcome is two rows the user can
// see and delete — not silent corruption.
async function requireAccountUnbudgeted(
  tx: Prisma.TransactionClient,
  periodId: string,
  accountId: string,
): Promise<void> {
  const existing = await tx.budgetItem.findFirst({
    where: { periodId, accountId, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error("That account already has a row this month");
  }
}

// A copy reads its account ids out of rows the caller already owns — but a
// write never trusts an id because of where it came from. Per ADR-002 the
// server Prisma role bypasses RLS, so this userId filter is the only fence,
// and an account can have been archived, deleted or re-kinded since the source
// row was written.
//
// The lookup sits outside the copy's $transaction, and moving it inside would
// buy nothing: under READ COMMITTED each statement takes its own snapshot, so
// a transaction gives rollback scope, not a frozen view of Account. The
// ownership half cannot race at all — nothing in the codebase reassigns
// Account.userId.
//
// A row whose anchor no longer holds is dropped rather than copied stripped:
// an anchor-less TRANSFER is a row createItemForMonth could not produce (zod
// rejects it), renders with no target, and mis-signs the month's surplus
// because a null direction reads as an inflow. Skipping is the honest outcome;
// the count comes back to the caller.
async function withValidAnchorsOnly(
  userId: string,
  rows: CopyableItem[],
): Promise<{ kept: CopyableItem[]; skipped: number }> {
  const anchorIds = rows
    .map((row) => row.accountId)
    .filter((id): id is string => id !== null);

  const accounts = anchorIds.length
    ? await prisma.account.findMany({
        where: { id: { in: anchorIds }, userId, deletedAt: null },
        select: { id: true, kind: true },
      })
    : [];
  const kindById = new Map(accounts.map((a) => [a.id, a.kind]));

  const kept = rows.flatMap((row) => {
    const required = requiredAnchorKind(row.type);
    // An unanchored kind has no anchor to keep — and never propagates a stray
    // one, which would carry an id past the fence on a row nothing checks.
    if (!required) return [{ ...row, accountId: null, direction: null }];
    if (!row.accountId) return [];
    if (kindById.get(row.accountId) !== required) return [];
    // A TRANSFER without a direction is unsigned: copying it would flip the
    // month's surplus by its budget.
    if (row.type === "TRANSFER") return row.direction ? [row] : [];
    // A REPAYMENT is always inward to the debt and never carries a direction —
    // a stray one is cleaned off for the same reason as a stray accountId.
    return [{ ...row, direction: null }];
  });

  return { kept, skipped: rows.length - kept.length };
}

// Adds a row to a month, creating that month's FinancialPeriod if this is the
// first row in it.
//
// One action rather than ensurePeriodForMonth followed by createItem: those ran
// as two requests from the sheet, so navigating between them left a period row
// with nothing in it — a month that looks visited but is empty. One transaction
// also halves the round trips on the slowest interaction in the sheet.
// The Category a named income or expense row belongs to, created if this is
// the first row to use that name.
//
// The plan reads the budget through categories, not through budget rows —
// reality.ts joins on categoryId — so a row without one is invisible to the
// plan no matter what is typed into it. Only the starter rows seeded at signup
// ever carried the link, which meant every row a user added themselves silently
// never reached their forecast.
//
// Matched on label alone within a type, deliberately: moving a row from Fixed
// to Variable should not fork "Groceries" into two categories that then compete
// for the same spending.
//
// Returns null for the anchored kinds. A transfer or repayment keys on an
// account, and giving it a categoryId would double-count it — once on the
// account's flow and once as an expense. That invariant is what reality.ts's
// own query relies on.
async function categoryIdForRow(
  tx: Prisma.TransactionClient,
  userId: string,
  row: {
    type: ItemType;
    label: string;
    section: CategorySection | null;
  },
): Promise<string | null> {
  const label = row.label.trim();
  if (label === "") return null;
  if (row.type !== "INCOME" && row.type !== "EXPENSE") return null;

  const existing = await tx.category.findFirst({
    where: { userId, deletedAt: null, type: row.type, label },
    select: { id: true },
  });
  if (existing) return existing.id;

  if (row.section === null) return null;

  const created = await tx.category.create({
    data: {
      userId,
      type: row.type,
      label,
      section: row.section,
    },
    select: { id: true },
  });
  return created.id;
}

export async function createItemForMonth(input: CreateItemForMonthInput) {
  const userId = await requireUserId();
  const parsed = createItemForMonthSchema.parse(input);
  const range = monthRangeFor(parsed.year, parsed.month);

  // A section is only meaningful on INCOME/EXPENSE rows; anchored rows key on
  // an account. Defaults match the sheet's first section on each side.
  const section: CategorySection | null =
    parsed.type === "EXPENSE"
      ? (parsed.section ?? "FIXED")
      : parsed.type === "INCOME"
        ? (parsed.section ?? "OTHER")
        : null;

  return prisma.$transaction(async (tx) => {
    if (parsed.accountId) {
      await requireAnchorAccount(tx, userId, parsed.type, parsed.accountId);
    }

    const period = await ensurePeriodForMonthIn(tx, userId, range);

    if (parsed.accountId) {
      await requireAccountUnbudgeted(tx, period.id, parsed.accountId);
    }

    // New row's sortOrder = max(sortOrder) + 1 within (periodId, type).
    const last = await tx.budgetItem.findFirst({
      where: { periodId: period.id, type: parsed.type, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const item = await tx.budgetItem.create({
      data: {
        periodId: period.id,
        type: parsed.type,
        section,
        label: parsed.label,
        ...(parsed.budget !== undefined && { budget: parsed.budget }),
        categoryId: await categoryIdForRow(tx, userId, {
          type: parsed.type,
          label: parsed.label,
          section,
        }),
        accountId: parsed.accountId ?? null,
        direction: parsed.direction ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return { periodId: period.id, item: toClientItem(item) };
  });
}

export async function updateItem(input: UpdateItemInput) {
  const userId = await requireUserId();
  const parsed = updateItemSchema.parse(input);

  const item = await prisma.budgetItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  // Section changes only make sense on INCOME/EXPENSE rows, and must match
  // the row's side.
  if (parsed.section !== undefined) {
    if (item.type !== "INCOME" && item.type !== "EXPENSE") {
      throw new Error(`${item.type} rows have no section`);
    }
    sectionFor(item.type, parsed.section); // throws on a mismatch
  }

  // Naming a row is what gives it a category, and therefore what makes it
  // visible to the plan. Rows are added blank from the Add drawer and named
  // afterwards, so this — not create — is where the link is usually made.
  // Re-resolved whenever the label changes so a rename follows the row.
  return toClientItem(
    await prisma.$transaction(async (tx) => {
      const label = parsed.label ?? item.label;
      const relink =
        parsed.label !== undefined || item.categoryId === null
          ? {
              categoryId: await categoryIdForRow(tx, userId, {
                type: item.type,
                label,
                section: parsed.section ?? item.section,
              }),
            }
          : {};

      return tx.budgetItem.update({
        where: { id: parsed.itemId },
        data: {
          ...(parsed.label !== undefined && { label: parsed.label }),
          ...(parsed.budget !== undefined && { budget: parsed.budget }),
          ...(parsed.actual !== undefined && { actual: parsed.actual }),
          ...(parsed.section !== undefined && { section: parsed.section }),
          ...relink,
        },
      });
    }),
  );
}

// Soft-delete an item.
export async function deleteItem(input: DeleteItemInput) {
  const userId = await requireUserId();
  const parsed = deleteItemSchema.parse(input);

  const item = await prisma.budgetItem.findFirst({
    where: { id: parsed.itemId, deletedAt: null },
    include: { period: { select: { userId: true } } },
  });
  if (!item || item.period.userId !== userId) {
    throw new Error("Item not found");
  }

  await prisma.budgetItem.update({
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

  const sourceItems = await prisma.budgetItem.findMany({
    where: { periodId: source.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      section: true,
      categoryId: true,
      accountId: true,
      direction: true,
      label: true,
      budget: true,
      sortOrder: true,
    },
  });

  const { kept, skipped } = await withValidAnchorsOnly(
    userId,
    sourceItems.map((it) => ({ ...it, budget: Number(it.budget) })),
  );

  const copied = buildCopiedItems(kept, randomUUID);

  await prisma.$transaction([
    prisma.budgetItem.updateMany({
      where: { periodId: target.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.budgetItem.createMany({
      data: copied.map((it) => ({
        id: it.id,
        periodId: target.id,
        type: it.type,
        section: it.section,
        categoryId: it.categoryId,
        accountId: it.accountId,
        direction: it.direction,
        label: it.label,
        budget: it.budget,
        actual: it.actual,
        sortOrder: it.sortOrder,
      })),
    }),
  ]);

  return {
    periodId: target.id,
    items: await withComputedActuals(userId, copied, range),
    // Rows whose anchor account no longer holds are left behind rather than
    // copied malformed; the count is the only trace of that.
    skipped,
  };
}

// In transactions mode a row's actual is computed from its transactions, not
// the stored column — mirror the budget page's overlay so the client can adopt
// the returned rows without a refetch showing 0s.
//
// Both halves of that overlay, routed on the row's kind exactly as the page
// routes: a category-keyed row nets its category's transactions, an
// account-keyed one nets its account's transfer flow. With only the category
// half, copying a month with a real mortgage flow already recorded returned
// the repayment at £0.00 — the row, the Expenses actual and "Left over" all
// wrong until the user navigated away and back.
async function withComputedActuals(
  userId: string,
  items: CopiedItem[],
  range: { startDate: Date; endDate: Date },
): Promise<CopiedItem[]> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { transactionsEnabled: true },
  });
  if (!settings?.transactionsEnabled) return items;

  const amounts = await getAmountsByCategory(
    userId,
    items.map((i) => i.categoryId).filter((id): id is string => id !== null),
    range.startDate,
    range.endDate,
  );
  const transferFlow = items.some((i) => isAccountKeyed(i.type))
    ? await getTransferFlowByAccount(userId, range.startDate, range.endDate)
    : new Map<string, number>();

  return items.map((i) => ({
    ...i,
    actual: isAccountKeyed(i.type)
      ? accountActual(
          transferFlow.get(i.accountId ?? "") ?? 0,
          i.type,
          i.direction,
        )
      : i.categoryId
        ? netActual(amounts.get(i.categoryId) ?? [], i.type)
        : 0,
  }));
}

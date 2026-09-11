// The ledger's filter predicate, as a pure function. Extracted from
// getTransactionsPage so every filter can be pinned by unit tests without a
// database — and so the page query and any future count of the same rows can
// never drift apart on what "matching" means.

import type { Prisma } from "@prisma/client";
import type { CategoryFilter } from "./pagination";

export type LedgerFilters = {
  search?: string;
  onlyUncategorized?: boolean;
  /** Inclusive YYYY-MM-DD bounds, as validated by parseLedgerSearchParams. */
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  category?: CategoryFilter;
  /** Non-negative magnitudes: amounts are matched on absolute value. */
  amountMin?: number | null;
  amountMax?: number | null;
};

// Transaction.date is a @db.Date, so every stored value sits at UTC midnight
// and both ends of the range are inclusive with no timezone arithmetic.
const atUtcMidnight = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00.000Z`);

function dateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: atUtcMidnight(from) } : {}),
    ...(to ? { lte: atUtcMidnight(to) } : {}),
  };
}

function categoryClause(
  category: CategoryFilter | undefined,
): Prisma.TransactionWhereInput {
  if (!category || category.kind === "any") return {};
  if (category.kind === "transfers")
    return { transferAccountId: { not: null } };
  return { categoryId: category.categoryId };
}

// Amounts are signed (an expense is negative), but a user hunting a £40 charge
// means "£40 either way". The two bounds therefore decompose differently:
//
//   |a| <= max  is  -max <= a <= max        — one range, no OR
//   |a| >= min  is  a >= min OR a <= -min   — everything outside (-min, min)
//
// They are separate clauses on purpose: an upper bound writes `amount`, a
// lower bound writes `OR`, so supplying both composes instead of colliding.
function amountClause(
  min: number | null | undefined,
  max: number | null | undefined,
): Prisma.TransactionWhereInput {
  return {
    ...(max === null || max === undefined
      ? {}
      : { amount: { gte: -max, lte: max } }),
    ...(min === null || min === undefined
      ? {}
      : { OR: [{ amount: { gte: min } }, { amount: { lte: -min } }] }),
  };
}

// Every ledger read goes through here. Fenced on userId — per ADR-002 the
// server Prisma role bypasses RLS, so this filter is the boundary.
export function ledgerWhere(
  userId: string,
  filters: LedgerFilters,
): Prisma.TransactionWhereInput {
  const search = filters.search?.trim();
  const date = dateRange(filters.from, filters.to);

  return {
    userId,
    deletedAt: null,
    ...(filters.onlyUncategorized
      ? { categoryId: null, transferAccountId: null }
      : {}),
    ...(search
      ? { description: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(date ? { date } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    // The uncategorized toggle and the category picker both write categoryId,
    // and the UI cannot show both at once — but a hand-edited or shared URL
    // can carry both. The toggle wins, so the outcome is chosen rather than
    // left to whichever clause happens to be spread last.
    ...(filters.onlyUncategorized ? {} : categoryClause(filters.category)),
    ...amountClause(filters.amountMin, filters.amountMax),
  };
}

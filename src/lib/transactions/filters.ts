// The ledger's filter predicate, as a pure function. Extracted from
// getTransactionsPage so every filter can be pinned by unit tests without a
// database — and so the page query and any future count of the same rows can
// never drift apart on what "matching" means.

import type { Prisma } from "@prisma/client";
import type { CategoryFilter } from "./pagination";

export type LedgerFilters = {
  search?: string;
  onlyUncategorized?: boolean;
  /** No category yet, or a category an import suggested that is not ticked. */
  onlyToCheck?: boolean;
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
  const and: Prisma.TransactionWhereInput[] = [
    ...(search ? [searchClause(search)] : []),
    ...(filters.onlyToCheck
      ? [
          {
            OR: [
              { categoryId: null, transferAccountId: null },
              { isCategoryConfirmed: false },
            ],
          },
        ]
      : []),
  ];

  return {
    userId,
    deletedAt: null,
    ...(filters.onlyUncategorized
      ? { categoryId: null, transferAccountId: null }
      : {}),
    ...(date ? { date } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    // The uncategorized toggle and the category picker both write categoryId,
    // and the UI cannot show both at once — but a hand-edited or shared URL
    // can carry both. The toggle wins, so the outcome is chosen rather than
    // left to whichever clause happens to be spread last.
    ...(filters.onlyUncategorized ? {} : categoryClause(filters.category)),
    ...amountClause(filters.amountMin, filters.amountMax),
    // Under AND, because amountClause can already own the top-level OR.
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

// Prisma passes `contains` into an ILIKE pattern unescaped, so a typed `%` or
// `_` acts as a wildcard: searching "50%" matched every row containing "50".
// Backslash is Postgres's default LIKE escape, so it is escaped first.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// The search box reads every field a person wrote or would recognise a row
// by: the statement description, their own note, the category's label, and
// for a transfer what its category cell says instead.
function searchClause(search: string): Prisma.TransactionWhereInput {
  const contains = {
    contains: escapeLike(search),
    mode: "insensitive" as const,
  };
  return {
    OR: [
      { description: contains },
      { note: contains },
      { category: { is: { label: contains } } },
      ...transferSearch(search),
    ],
  };
}

const IS_TRANSFER = { transferAccountId: { not: null } };

// A transfer has no category: its category cell reads "Transfer to ISA" (money
// out) or "Transfer from ISA" (money in), from the account it moved to or
// from. So a transfer is found by that account's name, by the word "transfer"
// or the start of it ("trans"), or by the phrase as the cell shows it.
function transferSearch(search: string): Prisma.TransactionWhereInput[] {
  const text = search.trim().toLowerCase();
  const byAccount = (name: string): Prisma.TransactionWhereInput => ({
    transferAccount: {
      is: { name: { contains: escapeLike(name), mode: "insensitive" } },
    },
  });

  const phrase = /^transfers?\s+(to|from)\b\s*(.*)$/.exec(text);
  if (phrase) {
    const [, direction, name = ""] = phrase;
    const sign = direction === "to" ? { lt: 0 } : { gt: 0 };
    return [
      {
        ...IS_TRANSFER,
        amount: sign,
        ...(name ? byAccount(name) : {}),
      },
    ];
  }

  const clauses = [byAccount(search.trim())];
  const namesTheKind =
    text.length >= 3 && ("transfers".startsWith(text) || text === "transfers");
  if (namesTheKind) clauses.push(IS_TRANSFER);
  return clauses;
}

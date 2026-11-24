import "server-only";

import type { AccountKind } from "@prisma/client";
import { kindOf } from "@/lib/accounts/accountDraft";
import { createCategoryWithinCap } from "@/lib/categories/createWithinCap";
import { categoryKey, cleanLabel } from "@/lib/categories/normalize";
import { sectionLabel } from "@/lib/categories/sections";
import { prisma } from "@/lib/prisma";
import { escapeLike, type LedgerFilters, ledgerWhere } from "./filters";
import { PAIR_WINDOW_DAYS } from "./import";
import { PAGE_SIZE, PAIRS_PER_PAGE } from "./pagination";
import {
  hiddenPairs,
  liveDismissals,
  type PairCandidate,
  type PossiblePair,
  pairKey,
  pairPossibleTransfers,
} from "./possibleTransfers";
import {
  type DatedTransferLeg,
  netTransfersByMonthAndAccount,
  netTransfersForAccounts,
} from "./transfers";

export type LedgerCategory = {
  id: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  // Human label of the budget section the category sits in (e.g. "Variable").
  section: string;
};

export type LedgerTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string | null;
  // False while the category is an import's suggestion, not yet ticked.
  isCategoryConfirmed: boolean;
  transferAccountId: string | null;
  accountId: string;
  accountName: string;
  note: string | null;
  // Kept CSV columns from import, keyed by header label.
  extra: Record<string, string> | null;
};

export type SortColumn =
  | "date"
  | "description"
  | "amount"
  | "account"
  | "category";
export type SortDir = "asc" | "desc";

export type LedgerQuery = LedgerFilters & {
  /** Rows to skip, or pairs under possibleTransfers. */
  offset?: number;
  /** Under possibleTransfers: list the pairs the user hid instead. */
  showHiddenPairs?: boolean;
  sortColumn?: SortColumn;
  sortDir?: SortDir;
};

// One pair in the possible-transfers view. Its two rows are in `items`, the
// money-out row first.
export type LedgerPair = PossiblePair & {
  outAccountName: string;
  inAccountName: string;
  isHidden: boolean;
};

export type LedgerPage = {
  items: LedgerTransaction[];
  // Total matching rows (all pages) for the same filters; pairs, when
  // `pairs` is set.
  total: number;
  // The possible-transfers view's pairs on this page; null in the ordinary
  // ledger.
  pairs: LedgerPair[] | null;
};

// Returns the user's categories, lazily provisioning them from existing budget
// line items the first time (when none exist yet). This is the one-time
// backfill described in the spec: distinct (type, normalized-label) pairs across
// all BudgetItems become Category rows, and each item is linked to its
// category so budget actuals can later roll up by categoryId. Idempotent — once
// any category exists it's a plain read.
export async function getOrProvisionCategories(
  userId: string,
): Promise<LedgerCategory[]> {
  const existing = await prisma.category.findMany({
    // Categories are never transfers or repayments — those key on accounts,
    // not categories — so this excludes the widened ItemType members that
    // can never actually appear on a Category row.
    where: { userId, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      label: true,
      type: true,
      section: true,
    },
  });
  if (existing.length > 0) {
    return existing.flatMap((c) => {
      // The query's `where` already excludes anything but INCOME/EXPENSE,
      // but ItemType is shared with BudgetItem, so the
      // Prisma-generated type for `c.type` is still the full enum. This
      // narrows it back down without a cast; unreachable in practice.
      if (c.type !== "INCOME" && c.type !== "EXPENSE") return [];
      return [
        {
          id: c.id,
          label: c.label,
          type: c.type,
          section: sectionLabel(c.section),
        },
      ];
    });
  }

  const items = await prisma.budgetItem.findMany({
    // Categories are never transfers or repayments, so this backfill —
    // which mints a Category per distinct BudgetItem (type, label) pair —
    // only ever considers the item types a Category can actually hold.
    where: {
      period: { userId },
      deletedAt: null,
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: {
      id: true,
      type: true,
      section: true,
      label: true,
    },
  });

  type Group = {
    type: "INCOME" | "EXPENSE";
    section: NonNullable<(typeof items)[number]["section"]>;
    label: string;
    itemIds: string[];
  };
  const groups = new Map<string, Group>();
  for (const item of items) {
    if (!item.label.trim()) continue;
    // Narrows the same way as the `existing` query above: the `where`
    // filter already excludes anything but INCOME/EXPENSE, but the
    // Prisma-generated type for `item.type` is still the full ItemType.
    if (item.type !== "INCOME" && item.type !== "EXPENSE") continue;
    // The DB check constraint (BudgetItem_section_matches_type) guarantees
    // an INCOME/EXPENSE row always carries a section; null here would be
    // corrupt data, not a case to silently seed a category for.
    if (item.section === null) continue;
    const key = `${item.type}::${categoryKey(item.label)}`;
    const group = groups.get(key) ?? {
      type: item.type,
      section: item.section,
      label: cleanLabel(item.label),
      itemIds: [],
    };
    group.itemIds.push(item.id);
    groups.set(key, group);
  }

  const groupList = Array.from(groups.values());

  const created: LedgerCategory[] = [];
  for (const [i, group] of groupList.entries()) {
    const category = await createCategoryWithinCap(prisma.category, {
      userId,
      type: group.type,
      section: group.section,
      label: group.label,
      sortOrder: i,
    });
    await prisma.budgetItem.updateMany({
      where: { id: { in: group.itemIds } },
      data: { categoryId: category.id },
    });
    created.push({
      id: category.id,
      label: category.label,
      // group.type (not category.type): the value we asked Prisma to write
      // is already narrowed to "INCOME" | "EXPENSE"; category.type comes
      // back typed as the full ItemType because that's the Category
      // model's column type, regardless of what was written.
      type: group.type,
      section: sectionLabel(group.section),
    });
  }

  created.sort(
    (a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
  );
  return created;
}

function serialize(tx: {
  id: string;
  date: Date;
  amount: { toString(): string };
  description: string;
  categoryId: string | null;
  isCategoryConfirmed: boolean;
  transferAccountId: string | null;
  accountId: string;
  account: { name: string };
  note: string | null;
  extra: unknown;
}): LedgerTransaction {
  return {
    id: tx.id,
    date: tx.date.toISOString(),
    amount: Number(tx.amount),
    description: tx.description,
    categoryId: tx.categoryId,
    isCategoryConfirmed: tx.isCategoryConfirmed,
    transferAccountId: tx.transferAccountId,
    accountId: tx.accountId,
    accountName: tx.account.name,
    note: tx.note,
    // `extra` is only ever written as a string→string object (see import).
    extra: (tx.extra as Record<string, string> | null) ?? null,
  };
}

// Maps a sortable column + direction to a Prisma orderBy, always tie-breaking
// on id so paging is stable. Offset paging is used (rather than keyset) because
// it composes cleanly with arbitrary column sorts and a text search.
function orderByFor(column: SortColumn, dir: SortDir) {
  switch (column) {
    case "amount":
      return [{ amount: dir }, { id: dir }];
    case "description":
      return [{ description: dir }, { id: dir }];
    case "account":
      return [{ account: { name: dir } }, { id: dir }];
    case "category":
      return [{ category: { label: dir } }, { id: dir }];
    default:
      return [{ date: dir }, { id: dir }];
  }
}

// One page of the ledger plus the total row count for the same filters, so
// the UI can render numbered pages. The predicate itself lives in ledgerWhere
// — a description search, the "uncategorized only" toggle, and the drawer's
// date / account / category / amount filters — leaving this function to paging
// and sorting. Both queries below share the one `where`, so the total can
// never describe a different set of rows than the page.
export async function getTransactionsPage(
  userId: string,
  query: LedgerQuery = {},
): Promise<LedgerPage> {
  if (query.possibleTransfers) return getPossibleTransfersPage(userId, query);

  const offset = query.offset ?? 0;
  const search = query.search?.trim();
  const where = ledgerWhere(
    userId,
    query,
    search ? await detailMatchIds(userId, search) : [],
  );

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: orderByFor(query.sortColumn ?? "date", query.sortDir ?? "desc"),
      skip: offset,
      take: PAGE_SIZE,
      select: LEDGER_ROW,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items: rows.map(serialize), total, pairs: null };
}

const LEDGER_ROW = {
  id: true,
  date: true,
  amount: true,
  description: true,
  categoryId: true,
  isCategoryConfirmed: true,
  transferAccountId: true,
  accountId: true,
  account: { select: { name: true } },
  note: true,
  extra: true,
} as const;

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

// The possible-transfers view, one page of pairs. Pairing runs over every row
// the user has, never one page, so a pair is the same whichever page or
// filter it is seen through. The other filters then choose which pairs show:
// a pair shows when either of its rows matches them, and both rows always
// show — filtering by Current still shows the Savings side.
async function getPossibleTransfersPage(
  userId: string,
  query: LedgerQuery,
): Promise<LedgerPage> {
  const search = query.search?.trim();
  const [candidates, dismissals, detailIds] = await Promise.all([
    possibleTransferCandidates(userId),
    prisma.dismissedTransferPair.findMany({ where: { userId } }),
    search ? detailMatchIds(userId, search) : Promise.resolve([]),
  ]);

  const live = liveDismissals(
    candidates,
    dismissals.map((d) => ({
      ...d,
      firstAmount: Number(d.firstAmount),
      secondAmount: Number(d.secondAmount),
      firstDate: isoDay(d.firstDate),
      secondDate: isoDay(d.secondDate),
    })),
  );
  const pairs = query.showHiddenPairs
    ? hiddenPairs(candidates, live)
    : pairPossibleTransfers(
        candidates,
        new Set(live.map((d) => pairKey(d.firstId, d.secondId))),
      );
  if (pairs.length === 0) return { items: [], total: 0, pairs: [] };

  const matching = await prisma.transaction.findMany({
    where: ledgerWhere(
      userId,
      query,
      detailIds,
      pairs.flatMap((pair) => [pair.outId, pair.inId]),
    ),
    select: { id: true },
  });
  const matched = new Set(matching.map((row) => row.id));
  const visible = pairs.filter(
    (pair) => matched.has(pair.outId) || matched.has(pair.inId),
  );

  const offset = query.offset ?? 0;
  const onPage = visible.slice(offset, offset + PAIRS_PER_PAGE);
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      id: { in: onPage.flatMap((pair) => [pair.outId, pair.inId]) },
    },
    select: LEDGER_ROW,
  });
  const byId = new Map(rows.map((row) => [row.id, serialize(row)]));

  const items: LedgerTransaction[] = [];
  const pagePairs: LedgerPair[] = [];
  for (const pair of onPage) {
    const out = byId.get(pair.outId);
    const into = byId.get(pair.inId);
    // Deleted between the two reads: drop the pair rather than show half.
    if (!out || !into) continue;
    items.push(out, into);
    pagePairs.push({
      ...pair,
      outAccountName: out.accountName,
      inAccountName: into.accountName,
      isHidden: Boolean(query.showHiddenPairs),
    });
  }
  return { items, total: visible.length, pairs: pagePairs };
}

/**
 * Every live row of the user's that has a possible opposite: same size,
 * opposite sign, another account, within PAIR_WINDOW_DAYS. A superset the pure
 * pairing then decides over. Fenced on the user (ADR-002).
 *
 * The join is on integer pence, not on `amount`: Postgres hashes a numeric
 * without its sign, so joining `amount = -amount` put every -£10 row in the
 * same hash bucket as every +£10 one and took 1.3-3s on 50k rows; on pence it
 * takes ~40ms, with no index.
 */
async function possibleTransferCandidates(
  userId: string,
): Promise<PairCandidate[]> {
  const rows = await prisma.$queryRaw<
    {
      outId: string;
      outDate: Date;
      outAmount: { toString(): string };
      outAccountId: string;
      outTransferAccountId: string | null;
      inId: string;
      inDate: Date;
      inAmount: { toString(): string };
      inAccountId: string;
      inTransferAccountId: string | null;
    }[]
  >`
    SELECT o.id AS "outId", o.date AS "outDate", o.amount AS "outAmount",
           o."accountId" AS "outAccountId",
           o."transferAccountId" AS "outTransferAccountId",
           i.id AS "inId", i.date AS "inDate", i.amount AS "inAmount",
           i."accountId" AS "inAccountId",
           i."transferAccountId" AS "inTransferAccountId"
    FROM "Transaction" o
    JOIN "Transaction" i
      ON i."userId" = o."userId"
     AND (i.amount * 100)::bigint = -(o.amount * 100)::bigint
     AND i."accountId" <> o."accountId"
     AND i.date BETWEEN o.date - ${PAIR_WINDOW_DAYS}::int
                    AND o.date + ${PAIR_WINDOW_DAYS}::int
    WHERE o."userId" = ${userId}::uuid
      AND o."deletedAt" IS NULL
      AND i."deletedAt" IS NULL
      AND o.amount < 0
      AND i.amount > 0`;

  const byId = new Map<string, PairCandidate>();
  for (const row of rows) {
    byId.set(row.outId, {
      id: row.outId,
      date: isoDay(row.outDate),
      amount: Number(row.outAmount),
      accountId: row.outAccountId,
      transferAccountId: row.outTransferAccountId,
    });
    byId.set(row.inId, {
      id: row.inId,
      date: isoDay(row.inDate),
      amount: Number(row.inAmount),
      accountId: row.inAccountId,
      transferAccountId: row.inTransferAccountId,
    });
  }
  return [...byId.values()];
}

/**
 * Ids of the user's rows whose kept import columns (the Details panel, stored
 * in `extra` as {"Type": "Pot transfer", …}) have a value containing `search`.
 *
 * Values only, never the keys: the column names vary by bank, and searching
 * "type" must not match every row that kept a Type column. Prisma has no
 * filter for "any value of a JSON object contains", hence raw SQL — tagged
 * and parameterised, so the search text is never spliced into the query.
 */
async function detailMatchIds(
  userId: string,
  search: string,
): Promise<string[]> {
  const pattern = `%${escapeLike(search)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT t.id
    FROM "Transaction" t
    WHERE t."userId" = ${userId}::uuid
      AND t."deletedAt" IS NULL
      AND jsonb_typeof(t.extra) = 'object'
      AND EXISTS (
        SELECT 1 FROM jsonb_each_text(t.extra) AS detail(key, value)
        WHERE detail.value ILIKE ${pattern}
      )`;
  return rows.map((row) => row.id);
}

// Count of uncategorized transactions, for the "needs attention" nudge. A
// transfer (transferAccountId set) is resolved, not uncategorized.
export async function countUncategorized(userId: string): Promise<number> {
  return prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      categoryId: null,
      transferAccountId: null,
    },
  });
}

// Count of categories an import pencilled in that the user has not ticked yet.
export async function countSuggested(userId: string): Promise<number> {
  return prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      isCategoryConfirmed: false,
      categoryId: { not: null },
    },
  });
}

// Signed transaction amounts per category in a date range, for overlaying
// computed actuals onto budget rows (via netActual). Categories with no
// transactions are simply absent from the map.
export async function getAmountsByCategory(
  userId: string,
  categoryIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number[]>> {
  const amounts = new Map<string, number[]>();
  if (categoryIds.length === 0) return amounts;

  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      categoryId: { in: categoryIds },
      date: { gte: start, lte: end },
    },
    select: { categoryId: true, amount: true },
  });
  for (const tx of txns) {
    if (!tx.categoryId) continue;
    const arr = amounts.get(tx.categoryId) ?? [];
    arr.push(Number(tx.amount));
    amounts.set(tx.categoryId, arr);
  }
  return amounts;
}

// Every transfer-tagged transaction in the period as a signed leg: its owning
// account, its counterparty, and the amount. Fenced on userId — per ADR-002
// the server Prisma role bypasses RLS, so this filter is the boundary. Shared
// by both transfer readers so their fencing can never drift apart.
async function transferLegs(
  userId: string,
  start: Date,
  end: Date,
): Promise<DatedTransferLeg[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      transferAccountId: { not: null },
      date: { gte: start, lte: end },
    },
    select: {
      amount: true,
      date: true,
      account: { select: { id: true, name: true } },
      transferAccount: { select: { id: true, name: true } },
    },
  });

  return rows.flatMap((r) =>
    r.transferAccount
      ? [
          {
            accountId: r.account.id,
            accountName: r.account.name,
            counterpartyId: r.transferAccount.id,
            counterpartyName: r.transferAccount.name,
            amount: Number(r.amount),
            date: r.date,
          },
        ]
      : [],
  );
}

// Net transfer flow per account for a period, signed relative to each account.
// One query, and netTransfersForAccounts decides which source counts.
export async function getTransferFlowByAccount(
  userId: string,
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const legs = await transferLegs(userId, start, end);

  // Both arguments are the same legs: a leg is "owned" by its own account and
  // "points at" its counterparty. The pure function picks one source per
  // counterparty pair, so passing the whole set to both is correct, not
  // double-counting.
  return netTransfersForAccounts(legs, legs);
}

// The same flow bucketed by (UTC month, account), for a window spanning more
// than one month — the dashboard's twelve. One query for the whole window, the
// account-keyed mirror of getAmountsByCategory's month-bucketed form; look a
// row up with monthAccountKey(period.startDate, item.accountId).
export async function getTransferFlowByMonthAndAccount(
  userId: string,
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  return netTransfersByMonthAndAccount(await transferLegs(userId, start, end));
}

// Active accounts for the ledger's transfer picker (id + name + kind, the
// latter derived from the account's type rather than read off the kind
// mirror column). Not filtered by kind — a plain current account is as valid
// a transfer target as any other asset — and not filtered by
// canImportTransactions either, so a mortgage you don't import statements
// from still shows up. CategoryCombobox partitions this same list into
// Transfers/Repayments by kind rather than re-querying it.
export async function getLedgerAccounts(
  userId: string,
): Promise<{ id: string; name: string; kind: AccountKind }[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: kindOf(a.type),
  }));
}

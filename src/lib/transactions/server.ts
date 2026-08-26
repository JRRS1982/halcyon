import "server-only";

import { sectionLabel } from "@/lib/categories/buckets";
import { categoryKey, cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "./pagination";
import { netTransfersByAccount, type TransferAccountRow } from "./transfers";

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

export type LedgerQuery = {
  offset?: number;
  search?: string;
  onlyUncategorized?: boolean;
  sortColumn?: SortColumn;
  sortDir?: SortDir;
};

export type LedgerPage = {
  items: LedgerTransaction[];
  // Total matching rows (all pages) for the same filters.
  total: number;
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
      category: true,
      incomeCategory: true,
    },
  });
  if (existing.length > 0) {
    return existing.flatMap((c) => {
      // The query's `where` already excludes anything but INCOME/EXPENSE,
      // but ItemType is shared with BudgetItem/BudgetTemplateItem, so the
      // Prisma-generated type for `c.type` is still the full enum. This
      // narrows it back down without a cast; unreachable in practice.
      if (c.type !== "INCOME" && c.type !== "EXPENSE") return [];
      return [
        {
          id: c.id,
          label: c.label,
          type: c.type,
          section: sectionLabel(c.category ?? c.incomeCategory),
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
      category: true,
      incomeCategory: true,
      label: true,
    },
  });

  type Group = {
    type: "INCOME" | "EXPENSE";
    category: (typeof items)[number]["category"];
    incomeCategory: (typeof items)[number]["incomeCategory"];
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
    const key = `${item.type}::${categoryKey(item.label)}`;
    const group = groups.get(key) ?? {
      type: item.type,
      category: item.category,
      incomeCategory: item.incomeCategory,
      label: cleanLabel(item.label),
      itemIds: [],
    };
    group.itemIds.push(item.id);
    groups.set(key, group);
  }

  const groupList = Array.from(groups.values());

  const created: LedgerCategory[] = [];
  for (const [i, group] of groupList.entries()) {
    const category = await prisma.category.create({
      data: {
        userId,
        type: group.type,
        category: group.category,
        incomeCategory: group.incomeCategory,
        label: group.label,
        sortOrder: i,
      },
      select: { id: true, label: true, type: true },
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
      section: sectionLabel(group.category ?? group.incomeCategory),
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
// the UI can render numbered pages. Supports a description phrase search, an
// optional "uncategorized only" filter, and sorting by any column.
export async function getTransactionsPage(
  userId: string,
  query: LedgerQuery = {},
): Promise<LedgerPage> {
  const offset = query.offset ?? 0;
  const search = query.search?.trim();

  const where = {
    userId,
    deletedAt: null,
    ...(query.onlyUncategorized
      ? { categoryId: null, transferAccountId: null }
      : {}),
    ...(search
      ? { description: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: orderByFor(query.sortColumn ?? "date", query.sortDir ?? "desc"),
      skip: offset,
      take: PAGE_SIZE,
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        categoryId: true,
        transferAccountId: true,
        accountId: true,
        account: { select: { name: true } },
        note: true,
        extra: true,
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items: rows.map(serialize), total };
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

// Per-account transfer flow for a period: signed net plus counterparty
// breakdown. Only transfer-tagged rows (transferAccountId set) participate, so
// income/expense is untouched. The owning account keys each row (see
// netTransfersByAccount) — the two legs of one transfer never collapse.
export async function getTransfersByAccount(
  userId: string,
  start: Date,
  end: Date,
): Promise<TransferAccountRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      transferAccountId: { not: null },
      date: { gte: start, lte: end },
    },
    select: {
      amount: true,
      account: { select: { id: true, name: true } },
      transferAccount: { select: { id: true, name: true } },
    },
  });

  return netTransfersByAccount(
    rows.flatMap((r) =>
      r.transferAccount
        ? [
            {
              accountId: r.account.id,
              accountName: r.account.name,
              counterpartyId: r.transferAccount.id,
              counterpartyName: r.transferAccount.name,
              amount: Number(r.amount),
            },
          ]
        : [],
    ),
  );
}

// Active accounts for the ledger's transfer picker (id + name).
export async function getLedgerAccounts(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return prisma.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

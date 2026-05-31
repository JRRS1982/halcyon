import "server-only";

import { categoryKey, cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "./pagination";

export type LedgerCategory = {
  id: string;
  label: string;
  type: "INCOME" | "EXPENSE";
};

export type LedgerTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string | null;
  accountName: string;
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
  nextOffset: number | null;
};

// Returns the user's categories, lazily provisioning them from existing budget
// line items the first time (when none exist yet). This is the one-time
// backfill described in the spec: distinct (type, normalized-label) pairs across
// all FinancialItems become Category rows, and each item is linked to its
// category so budget actuals can later roll up by categoryId. Idempotent — once
// any category exists it's a plain read.
export async function getOrProvisionCategories(
  userId: string,
): Promise<LedgerCategory[]> {
  const existing = await prisma.category.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, type: true },
  });
  if (existing.length > 0) return existing;

  const items = await prisma.financialItem.findMany({
    where: { period: { userId }, deletedAt: null },
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
  for (let i = 0; i < groupList.length; i++) {
    const group = groupList[i];
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
    await prisma.financialItem.updateMany({
      where: { id: { in: group.itemIds } },
      data: { categoryId: category.id },
    });
    created.push(category);
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
  account: { name: string };
}): LedgerTransaction {
  return {
    id: tx.id,
    date: tx.date.toISOString(),
    amount: Number(tx.amount),
    description: tx.description,
    categoryId: tx.categoryId,
    accountName: tx.account.name,
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

// One page of the ledger. Supports a description phrase search, an optional
// "uncategorized only" filter, and sorting by any column. `nextOffset` is the
// skip value for the next page, or null when the last page has been reached.
export async function getTransactionsPage(
  userId: string,
  query: LedgerQuery = {},
): Promise<LedgerPage> {
  const offset = query.offset ?? 0;
  const search = query.search?.trim();

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(query.onlyUncategorized ? { categoryId: null } : {}),
      ...(search
        ? { description: { contains: search, mode: "insensitive" } }
        : {}),
    },
    orderBy: orderByFor(query.sortColumn ?? "date", query.sortDir ?? "desc"),
    skip: offset,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      categoryId: true,
      account: { select: { name: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map(serialize);
  return { items, nextOffset: hasMore ? offset + PAGE_SIZE : null };
}

// Count of uncategorized transactions, for the "needs attention" nudge.
export async function countUncategorized(userId: string): Promise<number> {
  return prisma.transaction.count({
    where: { userId, deletedAt: null, categoryId: null },
  });
}

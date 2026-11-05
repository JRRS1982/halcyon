import "server-only";
import type { ItemType } from "@prisma/client";
import { formatYm } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { netActual } from "@/lib/transactions/actual";
import {
  type CategoryHistory,
  type HistoryEntry,
  type HistoryMonth,
  historyByCategory,
} from "./history";

const ymOf = (date: Date) =>
  formatYm(date.getUTCFullYear(), date.getUTCMonth());

/**
 * Each category's actuals across the user's recorded months before `before`,
 * read the same way the budget sheet reads a month: from transactions when
 * they are on, from the typed actuals when they are not. Fenced on userId, per
 * ADR-002.
 */
export async function getCategoryHistory({
  userId,
  categoryTypes,
  priorPeriods,
  before,
  transactionsEnabled,
}: {
  userId: string;
  categoryTypes: Map<string, ItemType>;
  // The user's recorded months before this one, oldest first.
  priorPeriods: { startDate: Date; label: string }[];
  before: Date;
  transactionsEnabled: boolean;
}): Promise<CategoryHistory> {
  const oldest = priorPeriods[0];
  const categoryIds = [...categoryTypes.keys()];
  if (!oldest || categoryIds.length === 0) return {};

  const months: HistoryMonth[] = priorPeriods.map((p) => ({
    ym: ymOf(p.startDate),
    label: p.label,
  }));

  if (!transactionsEnabled) {
    const items = await prisma.budgetItem.findMany({
      where: {
        deletedAt: null,
        categoryId: { in: categoryIds },
        period: {
          userId,
          granularity: "MONTH",
          startDate: { gte: oldest.startDate, lt: before },
        },
      },
      select: {
        categoryId: true,
        actual: true,
        period: { select: { startDate: true } },
      },
    });
    const entries: HistoryEntry[] = items.flatMap((item) =>
      item.categoryId
        ? [
            {
              categoryId: item.categoryId,
              ym: ymOf(item.period.startDate),
              actual: Number(item.actual),
            },
          ]
        : [],
    );
    return historyByCategory(entries, months);
  }

  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      categoryId: { in: categoryIds },
      date: { gte: oldest.startDate, lt: before },
    },
    select: { categoryId: true, amount: true, date: true },
  });

  // Net each category-month the way the sheet nets a month's actual.
  const amounts = new Map<
    string,
    { categoryId: string; ym: string; values: number[] }
  >();
  for (const tx of txns) {
    if (!tx.categoryId) continue;
    const ym = ymOf(tx.date);
    const key = `${tx.categoryId}|${ym}`;
    const bucket = amounts.get(key) ?? {
      categoryId: tx.categoryId,
      ym,
      values: [],
    };
    bucket.values.push(Number(tx.amount));
    amounts.set(key, bucket);
  }
  const entries: HistoryEntry[] = [...amounts.values()].map((bucket) => ({
    categoryId: bucket.categoryId,
    ym: bucket.ym,
    actual: netActual(
      bucket.values,
      categoryTypes.get(bucket.categoryId) ?? "EXPENSE",
    ),
  }));
  return historyByCategory(entries, months);
}

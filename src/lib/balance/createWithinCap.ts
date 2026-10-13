import type { BalanceItem, Prisma } from "@prisma/client";
import { MAX_ITEMS_PER_PERIOD, periodFullError } from "@/lib/budget/limits";
import { assertRoom } from "@/lib/limits/ceilings";

// The only place in the app that creates a BalanceItem.
//
// This model had no ceiling of any kind. The partial unique index on live
// (periodId, accountId) rows looked like one, but clearBalanceValue soft
// deletes and so releases the slot: upsert, clear, upsert on a single account
// and month wrote an unbounded chain of rows that nothing in the app could
// count. It shares the budget sheet's per-period ceiling because it is the
// same kind of thing — one row per account per month, on a page a person
// reads.
export type BalanceItemDelegate = {
  count(args: {
    where: { periodId: string; deletedAt?: null };
  }): Promise<number>;
  create(args: {
    data: Prisma.BalanceItemUncheckedCreateInput;
  }): Promise<BalanceItem>;
  createMany(args: {
    data: Prisma.BalanceItemUncheckedCreateInput[];
  }): Promise<{ count: number }>;
};

const roomFor = (db: BalanceItemDelegate, periodId: string, adding: number) =>
  assertRoom({
    countLive: () => db.count({ where: { periodId, deletedAt: null } }),
    countStored: () => db.count({ where: { periodId } }),
    liveMax: MAX_ITEMS_PER_PERIOD,
    liveError: periodFullError,
    adding,
  });

export async function createBalanceItemWithinCap(
  db: BalanceItemDelegate,
  data: Prisma.BalanceItemUncheckedCreateInput,
): Promise<BalanceItem> {
  await roomFor(db, data.periodId, 1);
  return db.create({ data });
}

export async function createBalanceItemsWithinCap(
  db: BalanceItemDelegate,
  periodId: string,
  data: Prisma.BalanceItemUncheckedCreateInput[],
): Promise<void> {
  if (data.length === 0) return;
  await roomFor(db, periodId, data.length);
  await db.createMany({ data });
}

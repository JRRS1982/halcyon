import type { BudgetItem, Prisma } from "@prisma/client";
import { assertRoom } from "@/lib/limits/ceilings";
import { MAX_ITEMS_PER_PERIOD, periodFullError } from "./limits";

// The only place in the app that creates a BudgetItem.
//
// MAX_ITEMS_PER_PERIOD was checked in createItemForMonth and in copyPeriodFrom
// and nowhere else, so deleteItem — three functions away in the same file, and
// a soft delete — reset it, and the budget page's own render created rows
// without consulting it at all. See lib/limits/ceilings.ts for why one number
// could not do both jobs.
export type BudgetItemDelegate = {
  count(args: {
    where: { periodId: string; deletedAt?: null };
  }): Promise<number>;
  create(args: {
    data: Prisma.BudgetItemUncheckedCreateInput;
  }): Promise<BudgetItem>;
  createMany(args: {
    data: Prisma.BudgetItemUncheckedCreateInput[];
  }): Promise<{ count: number }>;
};

const roomFor = (db: BudgetItemDelegate, periodId: string, adding: number) =>
  assertRoom({
    countLive: () => db.count({ where: { periodId, deletedAt: null } }),
    countStored: () => db.count({ where: { periodId } }),
    liveMax: MAX_ITEMS_PER_PERIOD,
    liveError: periodFullError,
    adding,
  });

export async function createBudgetItemWithinCap(
  db: BudgetItemDelegate,
  data: Prisma.BudgetItemUncheckedCreateInput,
): Promise<BudgetItem> {
  await roomFor(db, data.periodId, 1);
  return db.create({ data });
}

// The bulk path. `data` is allowed to be empty — the budget page materialises
// whatever is missing, which is often nothing.
export async function createBudgetItemsWithinCap(
  db: BudgetItemDelegate,
  periodId: string,
  data: Prisma.BudgetItemUncheckedCreateInput[],
): Promise<void> {
  if (data.length === 0) return;
  await roomFor(db, periodId, data.length);
  await db.createMany({ data });
}

import type { CategorySection } from "@prisma/client";

export type CopyableItem = {
  id: string;
  // Mirrors the full Prisma ItemType enum: a BudgetItem being copied can be
  // any of the four kinds. This function doesn't branch on type, so widening
  // it changes nothing about what gets copied.
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  section: CategorySection | null;
  // Link to the user's Category, when the source row has one. Carrying it
  // over is what keeps transaction-computed actuals attached to the copy.
  categoryId: string | null;
  // The anchor a TRANSFER/REPAYMENT row hangs on: the account the money moves
  // to or from, and (TRANSFER only) which way. Copying a row without these
  // produces a row the create action could never make — targetless, and signed
  // as an inflow because a null direction reads as one. Null on INCOME/EXPENSE.
  accountId: string | null;
  direction: "INFLOW" | "OUTFLOW" | null;
  label: string;
  budget: number;
  sortOrder: number;
};

export type CopiedItem = CopyableItem & { actual: number };

// Produce a fresh set of items mirroring `source` for another period: every
// item gets a new id (via makeId), its category/budget/label carry over, and
// actuals reset to 0 — a freshly-copied month hasn't been spent yet.
export function buildCopiedItems(
  source: CopyableItem[],
  makeId: () => string,
): CopiedItem[] {
  return source.map((item) => ({
    id: makeId(),
    type: item.type,
    section: item.section,
    categoryId: item.categoryId,
    accountId: item.accountId,
    direction: item.direction,
    label: item.label,
    budget: item.budget,
    actual: 0,
    sortOrder: item.sortOrder,
  }));
}

export type CopyableItem = {
  id: string;
  // Mirrors the full Prisma ItemType enum: a BudgetItem/BudgetTemplateItem
  // being copied can be any of the four kinds. This function doesn't branch
  // on type, so widening it changes nothing about what gets copied.
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  category: "FIXED" | "VARIABLE" | "DISCRETIONARY" | null;
  incomeCategory:
    | "SALARY"
    | "SIDE_INCOME"
    | "INVESTMENTS"
    | "PENSIONS"
    | "OTHER"
    | null;
  // Link to the user's Category, when the source row has one. Carrying it
  // over is what keeps transaction-computed actuals attached to the copy.
  categoryId: string | null;
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
    category: item.category,
    incomeCategory: item.incomeCategory,
    categoryId: item.categoryId,
    label: item.label,
    budget: item.budget,
    actual: 0,
    sortOrder: item.sortOrder,
  }));
}

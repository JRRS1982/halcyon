export type CopyableItem = {
  id: string;
  type: "INCOME" | "EXPENSE";
  parentItemId: string | null;
  category: "FIXED" | "VARIABLE" | "DISCRETIONARY" | null;
  incomeCategory:
    | "SALARY"
    | "SIDE_INCOME"
    | "INVESTMENTS"
    | "PENSIONS"
    | "OTHER"
    | null;
  label: string;
  budget: number;
  sortOrder: number;
};

export type CopiedItem = CopyableItem & { actual: number };

// Produce a fresh set of items mirroring `source`'s structure for another
// period: every item gets a new id (via makeId), parent references are
// remapped onto the new ids so the hierarchy is preserved, budgets carry
// over, and actuals reset to 0 — a freshly-copied month hasn't been spent
// yet. `source` should be ordered parents-before-children so the caller can
// insert the result in array order without tripping the parent FK.
export function buildCopiedItems(
  source: CopyableItem[],
  makeId: () => string,
): CopiedItem[] {
  const idMap = new Map<string, string>();
  for (const item of source) {
    idMap.set(item.id, makeId());
  }

  return source.map((item) => ({
    id: idMap.get(item.id) as string,
    type: item.type,
    parentItemId:
      item.parentItemId === null
        ? null
        : (idMap.get(item.parentItemId) ?? null),
    category: item.category,
    incomeCategory: item.incomeCategory,
    label: item.label,
    budget: item.budget,
    actual: 0,
    sortOrder: item.sortOrder,
  }));
}

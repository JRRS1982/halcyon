// Pure roll-up functions for the budget sheet. Operates on the simplified
// in-memory item shape used by the client (budget / actual as numbers).

export type ItemForTotals = {
  id: string;
  type: "INCOME" | "EXPENSE";
  parentItemId: string | null;
  budget: number;
  actual: number;
};

export type ItemAmounts = {
  budget: number;
  actual: number;
};

// Compute roll-up amounts for every item in the tree.
// A parent's effective amount is the sum of its children when it has
// children; its own (budget, actual) when it's a leaf. Mutually
// exclusive — a parent's own (budget, actual) are ignored when it has
// children (they exist in the schema but should be 0 for parents).
export function computeRollups(
  items: ItemForTotals[],
): Map<string, ItemAmounts> {
  const childrenByParent = new Map<string, ItemForTotals[]>();
  for (const item of items) {
    if (item.parentItemId === null) continue;
    const list = childrenByParent.get(item.parentItemId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentItemId, list);
  }

  const rollups = new Map<string, ItemAmounts>();

  function compute(item: ItemForTotals): ItemAmounts {
    if (rollups.has(item.id)) {
      return rollups.get(item.id) as ItemAmounts;
    }
    const children = childrenByParent.get(item.id) ?? [];
    if (children.length === 0) {
      const result = { budget: item.budget, actual: item.actual };
      rollups.set(item.id, result);
      return result;
    }
    let budget = 0;
    let actual = 0;
    for (const child of children) {
      const r = compute(child);
      budget += r.budget;
      actual += r.actual;
    }
    const result = { budget, actual };
    rollups.set(item.id, result);
    return result;
  }

  for (const item of items) {
    compute(item);
  }

  return rollups;
}

export type SectionTotals = {
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
};

// Computes the section roll-up over its top-level items only (children's
// amounts are already folded into their parent by computeRollups).
//
// Variance convention:
//   INCOME  → actual - budget  (positive = received more than planned)
//   EXPENSE → budget - actual  (positive = spent less than planned)
// % is actual / budget × 100; 0 when budget is 0 to avoid divide-by-zero.
export function sectionTotals(
  items: ItemForTotals[],
  type: "INCOME" | "EXPENSE",
  rollups: Map<string, ItemAmounts>,
): SectionTotals {
  let budget = 0;
  let actual = 0;
  for (const item of items) {
    if (item.type !== type) continue;
    if (item.parentItemId !== null) continue;
    const r = rollups.get(item.id);
    if (!r) continue;
    budget += r.budget;
    actual += r.actual;
  }
  const variance = type === "INCOME" ? actual - budget : budget - actual;
  const variancePct = budget === 0 ? 0 : Math.round((actual / budget) * 100);
  return { budget, actual, variance, variancePct };
}

export type GrandTotals = {
  budget: number;
  actual: number;
  variance: number;
};

export function grandTotals(
  income: SectionTotals,
  expense: SectionTotals,
): GrandTotals {
  const budget = income.budget - expense.budget;
  const actual = income.actual - expense.actual;
  const variance = actual - budget;
  return { budget, actual, variance };
}

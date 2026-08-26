// Pure roll-up functions for the budget sheet. Operates on the simplified
// in-memory item shape used by the client (budget / actual as numbers).

export type ItemForTotals = {
  id: string;
  // Mirrors the full Prisma ItemType enum: a BudgetItem can be any of the
  // four kinds. sectionTotals below filters by an exact type match, so a
  // TRANSFER/REPAYMENT item is simply excluded from both the INCOME and
  // EXPENSE roll-ups — computeRollups itself doesn't branch on type at all.
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  budget: number;
  actual: number;
};

export type ItemAmounts = {
  budget: number;
  actual: number;
};

// Items are a flat list, so each item's amount is simply its own
// (budget, actual). Returned as a Map keyed by id so call sites can look up
// amounts uniformly.
export function computeRollups(
  items: ItemForTotals[],
): Map<string, ItemAmounts> {
  const rollups = new Map<string, ItemAmounts>();
  for (const item of items) {
    rollups.set(item.id, { budget: item.budget, actual: item.actual });
  }
  return rollups;
}

export type SectionTotals = {
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
};

// Computes the section roll-up over every item of the given type.
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

// Pure planner for merging one category's budget line items into another.
//
// When two categories merge, the loser's FinancialItems must move to the
// survivor. In any month where the survivor *also* has a row, the two would
// collide (one category, two rows in a period) — so we combine them: add the
// loser's budget to the survivor's row and drop the loser's. In months the
// survivor has no row, the loser's row simply repoints to the survivor.
//
// Transactions don't collide (they reference the category, not a per-month
// row), so they always just repoint — handled by the caller.

export type MergeItem = { id: string; periodId: string; budget: number };

export type MergeItemPlan = {
  // Source item ids to repoint to the survivor (no collision in that period).
  repointIds: string[];
  // Collisions: add this budget to the survivor's existing row.
  combine: { survivorItemId: string; addBudget: number }[];
  // Source item ids to delete after their budget is combined in.
  deleteIds: string[];
};

export function planItemMerge(
  sourceItems: MergeItem[],
  survivorItemByPeriod: Record<string, string>,
): MergeItemPlan {
  const plan: MergeItemPlan = { repointIds: [], combine: [], deleteIds: [] };

  for (const item of sourceItems) {
    const survivorItemId = survivorItemByPeriod[item.periodId];
    if (survivorItemId) {
      plan.combine.push({ survivorItemId, addBudget: item.budget });
      plan.deleteIds.push(item.id);
    } else {
      plan.repointIds.push(item.id);
    }
  }

  return plan;
}

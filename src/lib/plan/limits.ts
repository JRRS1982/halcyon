// Per-plan ceiling on each kind of projection row.
//
// createPlanIncome, createPlanExpense and createPlanEvent take no arguments at
// all — call one, get a row — and createPlanAsset/createPlanLiability differ
// only in parsing input first. None of them had a ceiling, so a signed-in
// account could loop any of them and grow the shared Plan* tables without
// limit.
//
// This one self-amplifies in a way the transaction and period caps do not: the
// projection in src/lib/plan/ is O(rows x years to death age), so a bloated
// plan makes that user's own /plan page run a multi-million-cell calculation on
// every render, and exportMyData then tries to serialise all of it into a
// single string.
//
// Sizing: 200 of any one kind is far past what a person models — nobody has
// two hundred income streams — so this only ever bites automated abuse.
export const MAX_PLAN_ROWS_PER_KIND = 200;

// Shared so the one-at-a-time creates and the bulk Sync path report the same
// ceiling the same way. Sync bypassed this entirely until October 2026: the cap
// lived only in nextSortOrderWithinCap, which the manual creates call and
// applySyncPlan does not — so the constant read like the plan's ceiling while
// the bulk path walked past it.
export const planFullError = (kind: string) =>
  new Error(
    `This plan already has the maximum of ${MAX_PLAN_ROWS_PER_KIND} ${kind} rows.`,
  );

// The subset of a Prisma delegate this needs. Structural rather than a union of
// the five generated types: every Plan* child is counted and ordered the same
// way, and naming them individually would mean editing this file whenever a
// sixth is added.
export type PlanRowDelegate = {
  count(args: { where: { planId: string; deletedAt: null } }): Promise<number>;
  aggregate(args: {
    where: { planId: string; deletedAt: null };
    _max: { sortOrder: true };
  }): Promise<{ _max: { sortOrder: number | null } }>;
};

/**
 * The sortOrder a new row should take, provided the plan is under its ceiling.
 *
 * Every create already ran the aggregate; folding the count in beside it keeps
 * the cap and the ordering in one place rather than five, and means a sixth
 * row kind inherits the ceiling by construction instead of by remembering.
 *
 * Check-then-write, like MAX_TRANSACTIONS_PER_USER and MAX_PERIODS_PER_USER:
 * concurrent calls can each read the same count, so the real ceiling is this
 * plus whatever was in flight. Bounded and self-limiting, and accepted for the
 * same reasons — see the note in src/lib/budget/ensurePeriod.ts.
 */
export async function nextSortOrderWithinCap(
  delegate: PlanRowDelegate,
  planId: string,
  kind: string,
): Promise<number> {
  const [held, max] = await Promise.all([
    delegate.count({ where: { planId, deletedAt: null } }),
    delegate.aggregate({
      where: { planId, deletedAt: null },
      _max: { sortOrder: true },
    }),
  ]);

  if (held >= MAX_PLAN_ROWS_PER_KIND) throw planFullError(kind);

  return (max._max.sortOrder ?? -1) + 1;
}

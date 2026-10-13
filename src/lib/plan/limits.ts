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
  // deletedAt optional so one delegate serves both counts: omitted means
  // every row, tombstones included. See lib/limits/ceilings.ts.
  count(args: { where: { planId: string; deletedAt?: null } }): Promise<number>;
  aggregate(args: {
    where: { planId: string; deletedAt: null };
    _max: { sortOrder: true };
  }): Promise<{ _max: { sortOrder: number | null } }>;
};

// nextSortOrderWithinCap used to live here. It was the plan cap's gate, and
// its doc comment claimed a new row kind would inherit the ceiling "by
// construction instead of by remembering" — which was already false, because
// attachNewMortgage computed sortOrder by hand and created two rows without
// it. Ordering and the ceiling now travel with the create itself, in
// createPlanRowWithinCap.

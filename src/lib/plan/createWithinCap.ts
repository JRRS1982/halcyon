import { assertRoom } from "@/lib/limits/ceilings";
import { MAX_PLAN_ROWS_PER_KIND, planFullError } from "./limits";

// The only place in the app that creates a plan row.
//
// nextSortOrderWithinCap used to be the gate, and its own doc comment claimed
// a sixth row kind would "inherit the ceiling by construction instead of by
// remembering". That was already untrue: attachNewMortgage computed sortOrder
// by hand with its own aggregate and created a PlanLiability and a PlanExpense
// without ever consulting the cap, from two call sites. A gate only gates what
// routes through it, so creating the row is now part of the same function.
//
// Structural delegate rather than a union of the five generated types: every
// Plan* child is counted, ordered and written the same way, and naming them
// individually would mean editing this file whenever a sixth is added.
export type PlanRowDelegate<TData, TRow> = {
  count(args: { where: { planId: string; deletedAt?: null } }): Promise<number>;
  aggregate(args: {
    where: { planId: string; deletedAt: null };
    _max: { sortOrder: true };
  }): Promise<{ _max: { sortOrder: number | null } }>;
  create(args: { data: TData }): Promise<TRow>;
};

/**
 * Creates a plan row at the end of its kind's ordering, if the plan has room.
 *
 * `build` receives the sortOrder rather than the caller computing it, because
 * every caller computed it the same way and two of them computed it without
 * the cap attached.
 *
 * Check-then-write, like MAX_TRANSACTIONS_PER_USER and MAX_PERIODS_PER_USER:
 * concurrent calls can each read the same count, so the real ceiling is this
 * plus whatever was in flight. Bounded and self-limiting, and accepted for the
 * same reasons — see the note in src/lib/budget/ensurePeriod.ts.
 */
export async function createPlanRowWithinCap<TData, TRow>(
  db: PlanRowDelegate<TData, TRow>,
  planId: string,
  kind: string,
  build: (sortOrder: number) => TData,
): Promise<TRow> {
  const [, max] = await Promise.all([
    // Both ceilings: every deletePlan* stamps deletedAt, so the live count
    // alone let create/delete loop forever. See lib/limits/ceilings.ts.
    assertRoom({
      countLive: () => db.count({ where: { planId, deletedAt: null } }),
      countStored: () => db.count({ where: { planId } }),
      liveMax: MAX_PLAN_ROWS_PER_KIND,
      liveError: () => planFullError(kind),
    }),
    db.aggregate({
      where: { planId, deletedAt: null },
      _max: { sortOrder: true },
    }),
  ]);

  return db.create({ data: build((max._max.sortOrder ?? -1) + 1) });
}

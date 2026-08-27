// src/app/(app)/plan/planRecord.ts
//
// The one read of a user's primary plan, shared by the page's two consumers.
//
// Not a "use server" file on purpose: those may only export async functions,
// and this needs to export a type and a memoised wrapper. Nothing here is a
// client-callable endpoint — actions.ts and syncActions.ts stay the boundary.

import { cache } from "react";
import { prisma } from "@/lib/prisma";

// The primary plan with every live row hanging off it.
//
// The include is deliberately the wider of the two this replaces: all live
// events rather than only the PROPERTY_SALE ones, because getPrimaryPlan
// renders all of them and the sync path can narrow in memory (it already
// re-narrowed assetId there). Ordering is likewise the stricter of the two —
// sortOrder ascending, which the sheet needs and the sync path previously
// left to whatever order Postgres happened to return.
export async function loadPlanRecord(userId: string) {
  return prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    include: {
      assets: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      liabilities: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      incomes: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      expenses: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      events: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export type PlanRecord = NonNullable<
  Awaited<ReturnType<typeof loadPlanRecord>>
>;

/**
 * The same read, memoised for the duration of one request.
 *
 * /plan renders the plan twice over — once for the sheet itself and once for
 * the Sync preview — which used to be two identical round trips. React's
 * cache() deduplicates them within the render pass.
 *
 * Per request, never across: a later request re-reads, so a write is always
 * visible to the render that follows it.
 *
 * Read-only callers only. A path that is about to write must use
 * `loadPlanRecord` directly — see syncPlan, which explains why.
 */
export const loadPlanRecordForRender = cache(loadPlanRecord);

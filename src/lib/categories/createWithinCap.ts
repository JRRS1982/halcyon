import type { Category, Prisma } from "@prisma/client";
import { assertRoom } from "@/lib/limits/ceilings";
import { categoryLimitError, MAX_CATEGORIES_PER_USER } from "./limits";

// The only place in the app that creates a Category.
//
// There were four create sites and one of them checked the cap. That is the
// shape of every cap defect this codebase has had: the ceiling is written once
// and enforced wherever someone remembered, so the constant reads like a rule
// while most of the paths walk past it. A guard that depends on being called
// is not a guard, so this function owns the create and
// tests/unit/createSites.test.ts fails the build on a raw `category.create`
// anywhere else.
//
// Structural delegate rather than Prisma's generated type: the same function
// has to serve both `prisma` and a `$transaction` client, and the two do not
// unify. Mirrors PlanRowDelegate in plan/limits.ts.
export type CategoryDelegate = {
  // deletedAt optional so the same delegate serves both counts: omitted means
  // every row, including tombstones.
  count(args: { where: { userId: string; deletedAt?: null } }): Promise<number>;
  create(args: {
    data: Prisma.CategoryUncheckedCreateInput;
  }): Promise<Category>;
};

export async function createCategoryWithinCap(
  db: CategoryDelegate,
  data: Prisma.CategoryUncheckedCreateInput,
): Promise<Category> {
  // Two ceilings. The live one is what the user meets: deleting a category is
  // a soft delete so historical budget actuals still compute, and counting the
  // tombstones there would let a few rounds of tidying up lock the list for
  // good. That makes it a display ceiling, which is exactly why the second,
  // tombstone-inclusive one has to exist — without it, create/delete looped
  // forever behind a number that never moved.
  await assertRoom({
    countLive: () =>
      db.count({ where: { userId: data.userId, deletedAt: null } }),
    countStored: () => db.count({ where: { userId: data.userId } }),
    liveMax: MAX_CATEGORIES_PER_USER,
    liveError: categoryLimitError,
  });

  return db.create({ data });
}

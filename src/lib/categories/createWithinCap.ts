import type { Category, Prisma } from "@prisma/client";
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
  count(args: { where: { userId: string; deletedAt: null } }): Promise<number>;
  create(args: {
    data: Prisma.CategoryUncheckedCreateInput;
  }): Promise<Category>;
};

export async function createCategoryWithinCap(
  db: CategoryDelegate,
  data: Prisma.CategoryUncheckedCreateInput,
): Promise<Category> {
  // Live rows only: deleting a category is a soft delete so historical budget
  // actuals still compute, and counting the tombstones would let a few rounds
  // of tidying up lock the list for good. That makes this a display ceiling,
  // not a storage bound — the storage bound is the second check below.
  const held = await db.count({
    where: { userId: data.userId, deletedAt: null },
  });
  if (held >= MAX_CATEGORIES_PER_USER) throw categoryLimitError();

  return db.create({ data });
}

// src/lib/plan/realityDefaults.ts
//
// The classifications a *newly added* plan row starts life with, derived from
// how the user has already classified the account or budget category it
// mirrors. Restored verbatim from the deleted src/lib/plan/seed.ts, which
// carried them until creating a plan became a Sync against an empty plan.
//
// These are addition-time defaults only. They are never re-applied to an
// existing row: drawdown priority and start/end ages are on the spec's "Kept"
// list, so a Sync must leave a tuned row exactly as the user left it. See
// RealityDefaults in src/lib/plan/sync.ts.
//
// Imports no database — purity is a property of the module boundary, and a
// file importing src/lib/prisma drags in env validation that is unset in CI.
// The @prisma/client imports below are type-only and erased at compile time.

import type { AccountSection, PlanIncomeKind } from "@prisma/client";
import type { CategorySection, IncomeSection } from "@/lib/categories/sections";
import type { IncomeKind } from "@/lib/plan/types";

// Ascending = drawn down first. Cash before investments before property.
const DRAWDOWN_BY_CATEGORY: Record<AccountSection, number> = {
  CURRENT: 0,
  MEDIUM_TERM: 1,
  LONG_TERM: 2,
  OTHER: 3,
  PROPERTY: 9,
};

const INCOME_KIND_BY_SECTION = {
  SALARY: "SALARY",
  PENSIONS: "DB_PENSION",
  SIDE_INCOME: "SELF_EMPLOYMENT",
  INVESTMENTS: "OTHER",
  OTHER: "OTHER",
} satisfies Record<IncomeSection, PlanIncomeKind>;

// `Account.section` is required (unlike the free-typed line seed.ts used to
// read), so there is no term bucket left to fall back from.
export function drawdownPriorityFor(section: AccountSection): number {
  return DRAWDOWN_BY_CATEGORY[section];
}

// `Category.section` is required, but its type is the whole enum — an
// expense section reaching here is a caller bug that reads as OTHER rather
// than crashing the projection.
export function incomeKindFor(section: CategorySection): IncomeKind {
  const byAnySection: Partial<Record<CategorySection, PlanIncomeKind>> =
    INCOME_KIND_BY_SECTION;
  return byAnySection[section] ?? "OTHER";
}

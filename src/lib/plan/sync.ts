// src/lib/plan/sync.ts
//
// What a Sync would do, decided from data alone. Imports no database: the
// server action loads both sides and hands them here, so the button's counts,
// the per-row indicators and the confirmation list are all this one object
// rendered three ways — they cannot disagree with what the action writes.

import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan/types";

export type PlanRowKind = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";

export type PlanRow = {
  id: string;
  kind: PlanRowKind;
  label: string;
  /** Account id for ASSET/LIABILITY, category id for INCOME/EXPENSE. Null = plan-only. */
  linkId: string | null;
  /** openingValue, openingBalance, or annualAmount depending on kind. */
  value: number;
  /** PlanAsset.wrapper for ASSET rows. Null for LIABILITY/INCOME/EXPENSE — the wrapper enum is asset-only. */
  wrapper: Wrapper | null;
};

// Classifications a *new* row starts life with, derived from how the user has
// classified the account or category it mirrors (src/lib/plan/realityDefaults.ts).
//
// resolvePlanSync deliberately does NOT compare these. Drawdown priority and
// start/end ages are on the spec's "Kept" list — assumptions that survive a
// Sync — so a difference here is never an update: a user who tuned their
// drawdown order must not have it reset by pressing Sync. The field exists
// only to give an *addition* a starting point, an addition having no
// assumptions to preserve. Nesting them keeps that exclusion obvious: the
// equality check below reads three flat fields, and this object is not one.
export type RealityDefaults = {
  /** PlanAsset.drawdownPriority. Null for non-ASSET rows. */
  drawdownPriority: number | null;
  /** PlanIncome.kind. Null for non-INCOME rows. */
  incomeKind: IncomeKind | null;
  /** PlanExpense.category. Null for non-EXPENSE rows, or an uncategorised one. */
  expenseCategory: ExpenseCategory | null;
};

export type RealityRow = {
  linkId: string;
  kind: PlanRowKind;
  label: string;
  value: number;
  /** Account.wrapper for an ASSET row. Null for LIABILITY/INCOME/EXPENSE. */
  wrapper: Wrapper | null;
  /** Addition-time only — never compared. See RealityDefaults. */
  defaults: RealityDefaults;
};

export type SyncPlan = {
  updates: {
    id: string;
    value: number;
    label: string;
    wrapper: Wrapper | null;
  }[];
  additions: RealityRow[];
  removals: { id: string; label: string; reason: "plan-only" | "gone" }[];
  unchanged: string[];
};

// An account id and a category id could collide, and an asset row must never
// resolve against an income. Kind is part of the identity, not a filter.
const keyOf = (kind: PlanRowKind, linkId: string): string =>
  `${kind}::${linkId}`;

export function resolvePlanSync(
  rows: PlanRow[],
  reality: RealityRow[],
): SyncPlan {
  const byKey = new Map(reality.map((r) => [keyOf(r.kind, r.linkId), r]));
  const matched = new Set<string>();

  const updates: SyncPlan["updates"] = [];
  const removals: SyncPlan["removals"] = [];
  const unchanged: string[] = [];

  for (const row of rows) {
    if (row.linkId === null) {
      removals.push({ id: row.id, label: row.label, reason: "plan-only" });
      continue;
    }

    const key = keyOf(row.kind, row.linkId);
    const truth = byKey.get(key);
    if (!truth) {
      // Archived or hard-deleted: either way it is absent from reality, and
      // the user no longer has the thing.
      removals.push({ id: row.id, label: row.label, reason: "gone" });
      continue;
    }

    matched.add(key);
    if (
      row.value === truth.value &&
      row.label === truth.label &&
      row.wrapper === truth.wrapper
    ) {
      unchanged.push(row.id);
      continue;
    }
    updates.push({
      id: row.id,
      value: truth.value,
      label: truth.label,
      wrapper: truth.wrapper,
    });
  }

  // A row worth nothing carries no signal into the projection, and
  // provisionUserSettings seeds ~17 starter budget categories at £0 — without
  // this guard a brand-new user's first plan opens on a table of empty lines.
  // seed.ts skipped both `b.value <= 0` and `f.budget <= 0` for this reason.
  //
  // Additions only, never a filter on `reality`: a row absent from reality is
  // a *removal* with reason "gone", so dropping zeros there would delete a
  // paid-off mortgage's row — taking the user's tuned assumptions with it, and
  // silently, since the confirmation dialog only names plan-only rows.
  // Updating an existing row to £0 is correct; refusing to create a new one at
  // £0 is also correct. Applying it here rather than in the caller keeps the
  // button's count, the markers and the confirmation honest, since all three
  // render this one object.
  const additions = reality.filter(
    (r) => r.value > 0 && !matched.has(keyOf(r.kind, r.linkId)),
  );

  return { updates, additions, removals, unchanged };
}

export function syncChangeCount(plan: SyncPlan): number {
  return plan.updates.length + plan.additions.length + plan.removals.length;
}

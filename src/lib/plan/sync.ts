// src/lib/plan/sync.ts
//
// What a Sync would do, decided from data alone. Imports no database: the
// server action loads both sides and hands them here, so the button's counts,
// the per-row indicators and the confirmation list are all this one object
// rendered three ways — they cannot disagree with what the action writes.

import type { Wrapper } from "@/lib/plan/types";

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

export type RealityRow = {
  linkId: string;
  kind: PlanRowKind;
  label: string;
  value: number;
  /** Account.wrapper for an ASSET row. Null for LIABILITY/INCOME/EXPENSE. */
  wrapper: Wrapper | null;
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

  const additions = reality.filter(
    (r) => !matched.has(keyOf(r.kind, r.linkId)),
  );

  return { updates, additions, removals, unchanged };
}

export function syncChangeCount(plan: SyncPlan): number {
  return plan.updates.length + plan.additions.length + plan.removals.length;
}

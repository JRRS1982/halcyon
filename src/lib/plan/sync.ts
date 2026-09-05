// src/lib/plan/sync.ts
//
// What a Sync would do, decided from data alone. Imports no database: the
// server action loads both sides and hands them here, so the button's counts,
// the per-row indicators and the confirmation list are all this one object
// rendered three ways — they cannot disagree with what the action writes.

import { type RowTerms, rowTermsEqual } from "@/lib/plan/rowTerms";
import type { ExpenseSection, IncomeKind, Wrapper } from "@/lib/plan/types";

export type PlanRowKind = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";

/**
 * What a removal can be. Wider than PlanRowKind because a Sync can now remove
 * a PlanEvent — never on its own, only dragged off by the property it sells.
 */
export type RemovableKind = PlanRowKind | "EVENT";

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
  /**
   * Money budgeted into or against the thing this row mirrors:
   * PlanAsset.monthlyContribution for ASSET, PlanLiability.monthlyRepayment
   * for LIABILITY — both monthly, matching the budget row they are copied
   * from. Null for INCOME/EXPENSE, which mirror a category and have no such
   * column — the same shape as `wrapper` above.
   */
  flow: number | null;
  /**
   * The id of the row this one cannot outlive: a mortgage's property asset
   * (PlanLiability.linkedAssetId), a repayment's liability
   * (PlanExpense.liabilityId). Null when the row stands on its own.
   */
  dependsOn: string | null;
  /**
   * The projection parameters this row currently holds, in plan units (ages,
   * not dates). Empty for INCOME/EXPENSE — a category has no such parameters.
   */
  terms: RowTerms;
};

/**
 * Something that is only ever removed *with* something else, and so is never
 * classified against reality on its own. Today that is a PROPERTY_SALE
 * PlanEvent: it mirrors nothing on the balance sheet, so it can be neither
 * plan-only nor gone — but it cannot outlive the property it sells.
 */
export type DependentRow = {
  id: string;
  label: string;
  /** The id of the row it cannot outlive. Never null: that is what makes it a dependent. */
  dependsOn: string;
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
// equality check below reads four flat fields, and this object is not one.
export type RealityDefaults = {
  /** PlanAsset.drawdownPriority. Null for non-ASSET rows. */
  drawdownPriority: number | null;
  /** PlanIncome.kind. Null for non-INCOME rows. */
  incomeKind: IncomeKind | null;
  /** PlanExpense.section. Null for non-EXPENSE rows. */
  expenseSection: ExpenseSection | null;
};

export type RealityRow = {
  linkId: string;
  kind: PlanRowKind;
  label: string;
  value: number;
  /** Account.wrapper for an ASSET row. Null for LIABILITY/INCOME/EXPENSE. */
  wrapper: Wrapper | null;
  /**
   * What the budget says is flowing into this account — a TRANSFER INFLOW for
   * an ASSET row, a REPAYMENT for a LIABILITY one, both left monthly exactly
   * as the budget stores them and as PlanRow.flow above carries them. No unit
   * crosses the comparison.
   * Zero, not null, when nothing is budgeted: an account row's flow is always
   * an observation, and null would never equal the plan row's own column,
   * which defaults to 0 — reporting every unbudgeted account as changed on
   * every Sync. Null belongs to INCOME/EXPENSE rows, which have no flow at all.
   */
  flow: number | null;
  /** Addition-time only — never compared. See RealityDefaults. */
  defaults: RealityDefaults;
  /**
   * The account's or category's own projection parameters, already converted
   * to plan units (ages, not dates) — see reality.ts. Empty for INCOME/EXPENSE.
   */
  terms: RowTerms;
};

export type SyncRemoval = {
  id: string;
  label: string;
  /**
   * "plan-only" — no link, so reality has nothing to update it from.
   * "gone" — its account or category no longer exists.
   * "cascade" — it cannot outlive another row this Sync removes.
   */
  reason: "plan-only" | "gone" | "cascade";
  /** For "cascade", the id of the row it is going with. Null otherwise. */
  dependsOn: string | null;
};

export type SyncPlan = {
  updates: {
    id: string;
    value: number;
    label: string;
    wrapper: Wrapper | null;
    flow: number | null;
    terms: RowTerms;
  }[];
  additions: RealityRow[];
  removals: SyncRemoval[];
  unchanged: string[];
};

// An account id and a category id could collide, and an asset row must never
// resolve against an income. Kind is part of the identity, not a filter.
const keyOf = (kind: PlanRowKind, linkId: string): string =>
  `${kind}::${linkId}`;

// parent id -> the rows that cannot outlive it. Built from both inputs, so
// the closure below walks one graph rather than knowing which side an edge
// came from.
function dependentsByParent(
  rows: PlanRow[],
  dependents: DependentRow[],
): Map<string, DependentRow[]> {
  const byParent = new Map<string, DependentRow[]>();
  const add = (child: DependentRow) => {
    const siblings = byParent.get(child.dependsOn);
    if (siblings) siblings.push(child);
    else byParent.set(child.dependsOn, [child]);
  };
  for (const row of rows) {
    if (row.dependsOn === null) continue;
    add({ id: row.id, label: row.label, dependsOn: row.dependsOn });
  }
  for (const dependent of dependents) add(dependent);
  return byParent;
}

// Everything that goes with what is already going, transitively: a property
// takes its mortgage, which takes its repayment, and the property takes any
// sale event too. Breadth-first from the removals reality decided on, so the
// order is deterministic and a diamond or a cycle cannot loop — an id already
// removed is never queued twice, which is also what keeps a row that is both
// plan-only and dragged from being deleted or counted twice.
function cascadeRemovals(
  removals: SyncRemoval[],
  byParent: Map<string, DependentRow[]>,
): void {
  const removed = new Set(removals.map((r) => r.id));

  // `removals` is both the queue and the result: every entry appended below is
  // visited by this same loop, which is what makes the walk transitive.
  for (let i = 0; i < removals.length; i++) {
    const parent = removals[i];
    if (!parent) continue;
    for (const child of byParent.get(parent.id) ?? []) {
      if (removed.has(child.id)) continue;
      removed.add(child.id);
      removals.push({
        id: child.id,
        label: child.label,
        reason: "cascade",
        dependsOn: parent.id,
      });
    }
  }
}

export function resolvePlanSync(
  rows: PlanRow[],
  reality: RealityRow[],
  dependents: DependentRow[],
): SyncPlan {
  const byKey = new Map(reality.map((r) => [keyOf(r.kind, r.linkId), r]));
  const matched = new Set<string>();

  const updates: SyncPlan["updates"] = [];
  const removals: SyncPlan["removals"] = [];
  const unchanged: string[] = [];

  for (const row of rows) {
    if (row.linkId === null) {
      removals.push({
        id: row.id,
        label: row.label,
        reason: "plan-only",
        dependsOn: null,
      });
      continue;
    }

    const key = keyOf(row.kind, row.linkId);
    const truth = byKey.get(key);
    if (!truth) {
      // Archived or hard-deleted: either way it is absent from reality, and
      // the user no longer has the thing.
      removals.push({
        id: row.id,
        label: row.label,
        reason: "gone",
        dependsOn: null,
      });
      continue;
    }

    matched.add(key);
    if (
      row.value === truth.value &&
      row.label === truth.label &&
      row.wrapper === truth.wrapper &&
      row.flow === truth.flow &&
      rowTermsEqual(row.terms, truth.terms)
    ) {
      unchanged.push(row.id);
      continue;
    }
    updates.push({
      id: row.id,
      value: truth.value,
      label: truth.label,
      wrapper: truth.wrapper,
      flow: truth.flow,
      terms: truth.terms,
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
  //
  // A budgeted flow rescues a zero-valued row, because an account you have
  // just opened at £0 and are paying £500/mo into is not an empty row — it is
  // the case the feature exists for. Without this a Sync would report "Up to
  // date" while the contribution never reached the projection, self-healing
  // only once the balance went positive. A category can never take this
  // branch: its flow is null, which is what keeps the starter-rows guard
  // above doing its job.
  const additions = reality.filter(
    (r) =>
      (r.value > 0 || (r.flow ?? 0) > 0) &&
      !matched.has(keyOf(r.kind, r.linkId)),
  );

  cascadeRemovals(removals, dependentsByParent(rows, dependents));

  // A dragged row was classified against reality before the cascade reached
  // it, so it may be sitting in `updates` or `unchanged` as well. It is being
  // deleted: reporting it as an update would count it twice in the button's
  // breakdown and have applySyncPlan write a row it then throws away.
  //
  // `matched` is deliberately left alone. A mortgage dragged off by its
  // property while its own account is still on the balance sheet stays matched
  // here, so this Sync does not re-add it in the same press; the next preview
  // sees an unmirrored live account and offers it as an addition, which is the
  // honest answer — the debt still exists, now standing on its own.
  const dragged = new Set(
    removals.filter((r) => r.reason === "cascade").map((r) => r.id),
  );

  return {
    updates: updates.filter((u) => !dragged.has(u.id)),
    additions,
    removals,
    unchanged: unchanged.filter((id) => !dragged.has(id)),
  };
}

/**
 * The removals that must be named before they happen: plan-only rows, plus
 * anything a removal drags with it.
 *
 * A "gone" row is not among them. Archiving or deleting the account was itself
 * a deliberate act, made on the balance sheet's own delete panel — which named
 * counts and, for a permanent delete, required typing DELETE. Re-confirming a
 * decision already made deliberately is the friction that teaches people to
 * click past confirmations. What that removal *takes with it* has had no such
 * warning from anywhere, which is why it is here.
 *
 * Lives beside the resolver so the button's gate and the dialog's list are the
 * same rule read twice, not two rules that can drift.
 */
export function confirmableRemovals(removals: SyncRemoval[]): SyncRemoval[] {
  return removals.filter((r) => r.reason !== "gone");
}

export function syncChangeCount(plan: SyncPlan): number {
  return plan.updates.length + plan.additions.length + plan.removals.length;
}

// src/app/plan/syncIndicator.ts
//
// Pure lookup from a row id into where it stands against reality. No React
// import: the marker's logic is unit-tested without a render, the same rule
// that has caught defects elsewhere in this project when a rule could only be
// reached through fireEvent.

import type { SyncPlan } from "@/lib/plan/sync";

export type SyncIndicator = "synced" | "changed" | "plan-only" | "attached";

export function indicatorFor(rowId: string, plan: SyncPlan): SyncIndicator {
  if (plan.updates.some((u) => u.id === rowId)) return "changed";
  const removal = plan.removals.find((r) => r.id === rowId);
  if (!removal) return "synced";
  // "gone" still reads as plan-only: in both cases the row's link resolves to
  // nothing and Sync will delete it, which is all the marker claims.
  // "cascade" does not: the row may well be on the balance sheet — a mortgage
  // whose own account is live, going only because its property is not — so
  // saying "not on your balance sheet" would be false about it.
  return removal.reason === "cascade" ? "attached" : "plan-only";
}

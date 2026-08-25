// src/app/plan/syncIndicator.ts
//
// Pure lookup from a row id into where it stands against reality. No React
// import: the marker's logic is unit-tested without a render, the same rule
// that has caught defects elsewhere in this project when a rule could only be
// reached through fireEvent.

import type { SyncPlan } from "@/lib/plan/sync";

export type SyncIndicator = "synced" | "changed" | "plan-only";

export function indicatorFor(rowId: string, plan: SyncPlan): SyncIndicator {
  if (plan.updates.some((u) => u.id === rowId)) return "changed";
  if (plan.removals.some((r) => r.id === rowId)) return "plan-only";
  return "synced";
}

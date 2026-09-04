"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applySyncPlan } from "@/lib/plan/applySyncPlan";
import { latestReality } from "@/lib/plan/reality";
import { emptyRowTerms } from "@/lib/plan/rowTerms";
import {
  type DependentRow,
  type PlanRow,
  type RemovableKind,
  resolvePlanSync,
  type SyncPlan,
} from "@/lib/plan/sync";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  loadPlanRecord,
  loadPlanRecordForRender,
  type PlanRecord,
} from "./planRecord";

// Same contract as before — the signed-in user's id, or a redirect to sign-in
// with /plan as the return path. The difference is the call underneath:
// getCurrentUser is memoised with React's cache(), so a render that touches
// several of these actions authenticates once instead of once per action.
//
// Per-request memoisation, not a cache across requests: a signed-out visitor
// never inherits a previous request's session. getCurrentUser's own doc
// comment describes this being done for the layout and settings paths; the
// plan actions simply never adopted it.
async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/plan");
  return user.id;
}

// A Prisma.Decimal can't cross the comparison in resolvePlanSync as anything
// but a plain number, and a plan row's own growth/debt columns are nullable —
// see balance/page.tsx's numberOrNull for the same conversion at a sibling
// serialisation boundary.
const numberOrNull = (d: Prisma.Decimal | null): number | null =>
  d === null ? null : Number(d);

type LoadedPlan = {
  planId: string;
  rows: PlanRow[];
  /** PROPERTY_SALE events — never removed on their own, only with their property. */
  dependents: DependentRow[];
};

// The primary plan's rows, flattened into the shape resolvePlanSync compares
// against reality, plus the sale events that hang off them. Null when the user
// has no primary plan.
function toLoadedPlan(plan: PlanRecord): LoadedPlan {
  const rows: PlanRow[] = [
    ...plan.assets.map(
      (a): PlanRow => ({
        id: a.id,
        kind: "ASSET",
        label: a.label,
        linkId: a.accountId,
        value: Number(a.openingValue),
        wrapper: a.wrapper,
        // Monthly, and stored that way: AssetsTable renders it as …/mo.
        flow: Number(a.monthlyContribution),
        dependsOn: null,
        terms: {
          expectedReturnPct: numberOrNull(a.expectedReturnPct),
          feePct: Number(a.feePct),
          minAccessAge: a.minAccessAge,
          annualIncome: numberOrNull(a.annualIncome),
          incomeFromAge: a.incomeFromAge,
          interestPct: null,
          interestOnly: false,
          revisionRate: null,
          revisionAge: null,
          endAge: null,
        },
      }),
    ),
    ...plan.liabilities.map(
      (l): PlanRow => ({
        id: l.id,
        kind: "LIABILITY",
        label: l.label,
        linkId: l.accountId,
        value: Number(l.openingBalance),
        wrapper: null,
        // Monthly, and stored that way: liabilityStep does its own × 12 and
        // LiabilitiesTable renders it as …/mo. Not annualised to match the
        // asset above — see RealityRow.flow.
        flow: Number(l.monthlyRepayment),
        // A mortgage cannot outlive its property — the same invariant
        // deletePlanAsset enforces on the plan's own delete.
        dependsOn: l.linkedAssetId,
        terms: {
          expectedReturnPct: null,
          feePct: null,
          minAccessAge: null,
          annualIncome: null,
          incomeFromAge: null,
          interestPct: Number(l.interestPct),
          interestOnly: l.interestOnly,
          revisionRate: numberOrNull(l.revisionRate),
          revisionAge: l.revisionAge,
          endAge: l.endAge,
        },
      }),
    ),
    ...plan.incomes.map(
      (i): PlanRow => ({
        id: i.id,
        kind: "INCOME",
        label: i.label,
        linkId: i.categoryId,
        value: Number(i.annualAmount),
        wrapper: null,
        // A category row has no flow column for money to land in.
        flow: null,
        dependsOn: null,
        // A category has no projection parameters at all.
        terms: emptyRowTerms(),
      }),
    ),
    ...plan.expenses.map(
      (e): PlanRow => ({
        id: e.id,
        kind: "EXPENSE",
        label: e.label,
        linkId: e.categoryId,
        value: Number(e.annualAmount),
        wrapper: null,
        flow: null,
        // A repayment cannot outlive its debt — deletePlanLiability's
        // invariant, and deletePlanExpense refuses to delete one on its own.
        dependsOn: e.liabilityId,
        terms: emptyRowTerms(),
      }),
    ),
  ];

  // A sale event is not a PlanRow — it mirrors nothing on the balance sheet,
  // so it can be neither plan-only nor gone — but it cannot outlive the
  // property it sells.
  //
  // Only a sale that still names a property can be resolved against one. An
  // event whose assetId is already null is an existing orphan: there is
  // nothing left to say what it depended on, so Sync leaves it alone rather
  // than guessing. That pair of conditions used to be the query's `where`;
  // the shared record carries every live event (the sheet renders them all),
  // so the same predicate is applied here instead. flatMap rather than filter
  // + map because it also narrows assetId to non-null for the type.
  const dependents: DependentRow[] = plan.events.flatMap((e) =>
    e.kind !== "PROPERTY_SALE" || e.assetId === null
      ? []
      : [{ id: e.id, label: e.label, dependsOn: e.assetId }],
  );

  return { planId: plan.id, rows, dependents };
}

// applySyncPlan can't tell which model an update or removal id belongs to —
// SyncPlan carries no kind for those (only additions do). What we just loaded
// already knows, so build the lookup here rather than have applySyncPlan probe
// every model per id. A removal can now reach a PlanEvent, so the lookup spans
// five models rather than four.
function rowKindsOf(
  rows: PlanRow[],
  dependents: DependentRow[],
): Map<string, RemovableKind> {
  return new Map<string, RemovableKind>([
    ...rows.map((row): [string, RemovableKind] => [row.id, row.kind]),
    ...dependents.map((d): [string, RemovableKind] => [d.id, "EVENT"]),
  ]);
}

// What Sync would do, without doing it — the same object the button's counts,
// the per-row indicators and the confirmation dialog all render.
export async function getPlanSyncPreview(): Promise<SyncPlan | null> {
  const userId = await requireUserId();
  // The memoised read: /plan renders the sheet and this preview in one pass,
  // and they used to fetch the same plan twice.
  const plan = await loadPlanRecordForRender(userId);
  if (!plan) return null;
  const loaded = toLoadedPlan(plan);

  const reality = await latestReality(userId, plan.dateOfBirth);
  return resolvePlanSync(loaded.rows, reality, loaded.dependents);
}

// Performs a Sync and returns what it did.
export async function syncPlan(): Promise<SyncPlan> {
  const userId = await requireUserId();
  // Deliberately the *unmemoised* read, unlike the preview above. This path
  // writes, and Next re-renders /plan inside the same request afterwards — so
  // a plan cached here could be handed to the render that follows the write
  // and show pre-Sync values. Reading straight through keeps the memoised
  // entry unpopulated, so that render fetches fresh whatever the request
  // scoping turns out to be.
  const record = await loadPlanRecord(userId);
  if (!record) throw new Error("Plan not found");
  const loaded = toLoadedPlan(record);

  const reality = await latestReality(userId, record.dateOfBirth);
  const plan = resolvePlanSync(loaded.rows, reality, loaded.dependents);
  const rowKinds = rowKindsOf(loaded.rows, loaded.dependents);

  await prisma.$transaction((tx) =>
    applySyncPlan(tx, loaded.planId, userId, plan, rowKinds),
  );

  revalidatePath("/plan");
  return plan;
}

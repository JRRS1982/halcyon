"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applySyncPlan } from "@/lib/plan/applySyncPlan";
import { latestReality } from "@/lib/plan/reality";
import { type PlanRow, resolvePlanSync, type SyncPlan } from "@/lib/plan/sync";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/plan");
  return user.id;
}

type LoadedPlan = { planId: string; rows: PlanRow[] };

// The primary plan's rows, flattened into the shape resolvePlanSync compares
// against reality. Null when the user has no primary plan.
async function loadPrimaryPlanRows(userId: string): Promise<LoadedPlan | null> {
  const plan = await prisma.plan.findFirst({
    where: { userId, deletedAt: null, isPrimary: true },
    include: {
      assets: { where: { deletedAt: null } },
      liabilities: { where: { deletedAt: null } },
      incomes: { where: { deletedAt: null } },
      expenses: { where: { deletedAt: null } },
    },
  });
  if (!plan) return null;

  const rows: PlanRow[] = [
    ...plan.assets.map(
      (a): PlanRow => ({
        id: a.id,
        kind: "ASSET",
        label: a.label,
        linkId: a.accountId,
        value: Number(a.openingValue),
      }),
    ),
    ...plan.liabilities.map(
      (l): PlanRow => ({
        id: l.id,
        kind: "LIABILITY",
        label: l.label,
        linkId: l.accountId,
        value: Number(l.openingBalance),
      }),
    ),
    ...plan.incomes.map(
      (i): PlanRow => ({
        id: i.id,
        kind: "INCOME",
        label: i.label,
        linkId: i.categoryId,
        value: Number(i.annualAmount),
      }),
    ),
    ...plan.expenses.map(
      (e): PlanRow => ({
        id: e.id,
        kind: "EXPENSE",
        label: e.label,
        linkId: e.categoryId,
        value: Number(e.annualAmount),
      }),
    ),
  ];

  return { planId: plan.id, rows };
}

// What Sync would do, without doing it — the same object the button's counts,
// the per-row indicators and the confirmation dialog all render.
export async function getPlanSyncPreview(): Promise<SyncPlan | null> {
  const userId = await requireUserId();
  const loaded = await loadPrimaryPlanRows(userId);
  if (!loaded) return null;

  const reality = await latestReality(userId);
  return resolvePlanSync(loaded.rows, reality);
}

// Performs a Sync and returns what it did.
export async function syncPlan(): Promise<SyncPlan> {
  const userId = await requireUserId();
  const loaded = await loadPrimaryPlanRows(userId);
  if (!loaded) throw new Error("Plan not found");

  const reality = await latestReality(userId);
  const plan = resolvePlanSync(loaded.rows, reality);

  await prisma.$transaction((tx) =>
    applySyncPlan(tx, loaded.planId, userId, plan),
  );

  revalidatePath("/plan");
  return plan;
}

// src/lib/plan/applySyncPlan.ts
//
// Writes a SyncPlan (src/lib/plan/sync.ts) to the database. Takes a
// transaction client rather than opening its own transaction — syncActions.ts
// is "use server" and a server action cannot accept a transaction client, and
// Task 6 calls this from inside createPlan's own transaction. Lives here
// rather than in syncActions.ts so it stays importable from both places.

import type { Prisma } from "@prisma/client";
import type { RealityRow, SyncPlan } from "@/lib/plan/sync";

// Every write below is fenced by both the plan id and the userId — never
// trust that an id came from a plan/row the caller already checked. See
// docs/superpowers/specs/2026-08-25-plan-sync-design.md's "Authorization"
// section and the P1 Critical it references.
type RowFence = { id: string; plan: { id: string; userId: string } };

// An update or removal id can belong to any one of the four plan-row models —
// SyncPlan carries no kind for these (only additions do, via RealityRow) — so
// each is tried in turn, fenced, and only one will ever match.
async function updateRow(
  tx: Prisma.TransactionClient,
  fence: RowFence,
  update: { value: number; label: string },
): Promise<void> {
  const { label, value } = update;

  const asset = await tx.planAsset.updateMany({
    where: fence,
    data: { label, openingValue: value },
  });
  if (asset.count > 0) return;

  const liability = await tx.planLiability.updateMany({
    where: fence,
    data: { label, openingBalance: value },
  });
  if (liability.count > 0) return;

  const income = await tx.planIncome.updateMany({
    where: fence,
    data: { label, annualAmount: value },
  });
  if (income.count > 0) return;

  await tx.planExpense.updateMany({
    where: fence,
    data: { label, annualAmount: value },
  });
}

async function removeRow(
  tx: Prisma.TransactionClient,
  fence: RowFence,
): Promise<void> {
  const asset = await tx.planAsset.deleteMany({ where: fence });
  if (asset.count > 0) return;

  const liability = await tx.planLiability.deleteMany({ where: fence });
  if (liability.count > 0) return;

  const income = await tx.planIncome.deleteMany({ where: fence });
  if (income.count > 0) return;

  await tx.planExpense.deleteMany({ where: fence });
}

// Additions carry their own kind (RealityRow), so which model to create in is
// known directly — no probing needed. New rows get every schema default for
// their assumptions; only the link, label and value come from reality.
async function addRow(
  tx: Prisma.TransactionClient,
  planId: string,
  addition: RealityRow,
): Promise<void> {
  switch (addition.kind) {
    case "ASSET":
      await tx.planAsset.create({
        data: {
          planId,
          label: addition.label,
          accountId: addition.linkId,
          openingValue: addition.value,
        },
      });
      return;
    case "LIABILITY":
      await tx.planLiability.create({
        data: {
          planId,
          label: addition.label,
          accountId: addition.linkId,
          openingBalance: addition.value,
        },
      });
      return;
    case "INCOME":
      await tx.planIncome.create({
        data: {
          planId,
          label: addition.label,
          categoryId: addition.linkId,
          annualAmount: addition.value,
          kind: "OTHER",
        },
      });
      return;
    case "EXPENSE":
      await tx.planExpense.create({
        data: {
          planId,
          label: addition.label,
          categoryId: addition.linkId,
          annualAmount: addition.value,
        },
      });
      return;
  }
}

export async function applySyncPlan(
  tx: Prisma.TransactionClient,
  planId: string,
  userId: string,
  plan: SyncPlan,
): Promise<void> {
  for (const update of plan.updates) {
    await updateRow(
      tx,
      { id: update.id, plan: { id: planId, userId } },
      update,
    );
  }

  for (const removal of plan.removals) {
    await removeRow(tx, { id: removal.id, plan: { id: planId, userId } });
  }

  for (const addition of plan.additions) {
    await addRow(tx, planId, addition);
  }
}

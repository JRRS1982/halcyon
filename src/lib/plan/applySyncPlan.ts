// src/lib/plan/applySyncPlan.ts
//
// Writes a SyncPlan (src/lib/plan/sync.ts) to the database. Takes a
// transaction client rather than opening its own transaction — syncActions.ts
// is "use server" and a server action cannot accept a transaction client, and
// Task 6 calls this from inside createPlan's own transaction. Lives here
// rather than in syncActions.ts so it stays importable from both places.

import type { Prisma } from "@prisma/client";
import type { PlanRowKind, RealityRow, SyncPlan } from "@/lib/plan/sync";

// Every write below is fenced by both the plan id and the userId. `create`
// can't carry a `where`, so additions rely on the up-front ownership check in
// applySyncPlan; every update/delete additionally carries the same fence in
// its own `where`.
type RowFence = { id: string; plan: { id: string; userId: string } };

// SyncPlan's updates/removals carry no kind (only additions do, via
// RealityRow — see sync.test.ts, which locks the exact shape of both arrays
// and would break if a field were added). The caller already knows each
// existing row's kind — it read the rows to build the plan in the first
// place — so it passes that lookup in rather than this function probing all
// four models per id.
async function updateRow(
  tx: Prisma.TransactionClient,
  fence: RowFence,
  kind: PlanRowKind,
  update: { value: number; label: string },
): Promise<void> {
  const { label, value } = update;

  switch (kind) {
    case "ASSET": {
      const res = await tx.planAsset.updateMany({
        where: fence,
        data: { label, openingValue: value },
      });
      if (res.count === 0) {
        throw new Error(
          `Sync update rejected: asset ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "LIABILITY": {
      const res = await tx.planLiability.updateMany({
        where: fence,
        data: { label, openingBalance: value },
      });
      if (res.count === 0) {
        throw new Error(
          `Sync update rejected: liability ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "INCOME": {
      const res = await tx.planIncome.updateMany({
        where: fence,
        data: { label, annualAmount: value },
      });
      if (res.count === 0) {
        throw new Error(
          `Sync update rejected: income ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "EXPENSE": {
      const res = await tx.planExpense.updateMany({
        where: fence,
        data: { label, annualAmount: value },
      });
      if (res.count === 0) {
        throw new Error(
          `Sync update rejected: expense ${fence.id} not found for this plan`,
        );
      }
      return;
    }
  }
}

async function removeRow(
  tx: Prisma.TransactionClient,
  fence: RowFence,
  kind: PlanRowKind,
): Promise<void> {
  switch (kind) {
    case "ASSET": {
      const res = await tx.planAsset.deleteMany({ where: fence });
      if (res.count === 0) {
        throw new Error(
          `Sync removal rejected: asset ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "LIABILITY": {
      const res = await tx.planLiability.deleteMany({ where: fence });
      if (res.count === 0) {
        throw new Error(
          `Sync removal rejected: liability ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "INCOME": {
      const res = await tx.planIncome.deleteMany({ where: fence });
      if (res.count === 0) {
        throw new Error(
          `Sync removal rejected: income ${fence.id} not found for this plan`,
        );
      }
      return;
    }
    case "EXPENSE": {
      const res = await tx.planExpense.deleteMany({ where: fence });
      if (res.count === 0) {
        throw new Error(
          `Sync removal rejected: expense ${fence.id} not found for this plan`,
        );
      }
      return;
    }
  }
}

// Additions carry their own kind (RealityRow), so which model to create in is
// known directly. New rows get every schema default for their assumptions;
// only the link, label and value come from reality.
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
  rowKinds: ReadonlyMap<string, PlanRowKind>,
): Promise<void> {
  // Additions can't be fenced by a `where`, so this is the only check that
  // stands between them and writing onto a plan the caller doesn't own.
  const owned = await tx.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Plan not found");

  for (const update of plan.updates) {
    const kind = rowKinds.get(update.id);
    if (!kind) {
      throw new Error(`Sync update rejected: unknown row ${update.id}`);
    }
    await updateRow(
      tx,
      { id: update.id, plan: { id: planId, userId } },
      kind,
      update,
    );
  }

  for (const removal of plan.removals) {
    const kind = rowKinds.get(removal.id);
    if (!kind) {
      throw new Error(`Sync removal rejected: unknown row ${removal.id}`);
    }
    await removeRow(tx, { id: removal.id, plan: { id: planId, userId } }, kind);
  }

  for (const addition of plan.additions) {
    await addRow(tx, planId, addition);
  }
}

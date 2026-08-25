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
  // Derived from SyncPlan rather than restated structurally: a hand-copied
  // shape silently drifting from the real one is exactly how `wrapper` came to
  // be dropped here. Deriving it makes the next such omission a compile error.
  update: SyncPlan["updates"][number],
): Promise<void> {
  const { label, value } = update;

  switch (kind) {
    case "ASSET": {
      // PlanAsset.wrapper isn't nullable (schema default OTHER) — a null
      // reality wrapper (an ASSET account somehow left without one) falls
      // back to that default rather than being written as null.
      const res = await tx.planAsset.updateMany({
        where: fence,
        data: {
          label,
          openingValue: value,
          wrapper: update.wrapper ?? "OTHER",
        },
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
// known directly. A new row has no assumptions to preserve, so it takes the
// classifications the user has already stated about the account or category it
// mirrors (RealityRow.defaults) and the schema default for everything else.
// updateRow deliberately writes none of these: on an existing row they are the
// spec's Kept assumptions, and a Sync must leave them as the user left them.
async function addRow(
  tx: Prisma.TransactionClient,
  planId: string,
  addition: RealityRow,
  retirementAge: number,
  sortOrder: number,
): Promise<void> {
  const { defaults } = addition;

  switch (addition.kind) {
    case "ASSET":
      await tx.planAsset.create({
        data: {
          planId,
          label: addition.label,
          accountId: addition.linkId,
          openingValue: addition.value,
          sortOrder,
          // See updateRow's ASSET case for the null fallback.
          wrapper: addition.wrapper ?? "OTHER",
          // Null only on a non-ASSET row, so unreachable here; 0 is the
          // schema default. Without this every synced asset shares that
          // default, and src/lib/plan/assets.ts sees a flat tie — drawdown
          // order becomes incidental rather than cash-first.
          drawdownPriority: defaults.drawdownPriority ?? 0,
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
          sortOrder,
        },
      });
      return;
    case "INCOME": {
      const kind = defaults.incomeKind ?? "OTHER";
      await tx.planIncome.create({
        data: {
          planId,
          label: addition.label,
          categoryId: addition.linkId,
          annualAmount: addition.value,
          sortOrder,
          kind,
          // A salary stops at retirement; anything else runs to the end of the
          // projection. Left null, a synced salary projects on to
          // expectedDeathAge (src/lib/plan/streams.ts → helpers.ts) and
          // overstates lifetime income by decades.
          endAge: kind === "SALARY" ? retirementAge : null,
        },
      });
      return;
    }
    case "EXPENSE":
      await tx.planExpense.create({
        data: {
          planId,
          label: addition.label,
          categoryId: addition.linkId,
          annualAmount: addition.value,
          sortOrder,
          // Nullable on both sides: an uncategorised category stays
          // uncategorised rather than reading as UNCATEGORISED in the
          // projection and the timeline.
          category: defaults.expenseCategory,
        },
      });
      return;
  }
}

// The next free sortOrder on each of the four models, read once. addRow's
// creates left it at the schema default of 0, so every synced row tied — and
// src/lib/plan/assets.ts sorts by drawdownPriority with a stable sort, so two
// assets in the same bucket drained in whatever order the query returned.
// Same shape as the create paths in plan/actions.ts: (max ?? -1) + 1.
async function nextSortOrders(
  tx: Prisma.TransactionClient,
  planId: string,
): Promise<Record<PlanRowKind, number>> {
  const where = { planId, deletedAt: null };
  const [asset, liability, income, expense] = await Promise.all([
    tx.planAsset.aggregate({ where, _max: { sortOrder: true } }),
    tx.planLiability.aggregate({ where, _max: { sortOrder: true } }),
    tx.planIncome.aggregate({ where, _max: { sortOrder: true } }),
    tx.planExpense.aggregate({ where, _max: { sortOrder: true } }),
  ]);
  return {
    ASSET: (asset._max.sortOrder ?? -1) + 1,
    LIABILITY: (liability._max.sortOrder ?? -1) + 1,
    INCOME: (income._max.sortOrder ?? -1) + 1,
    EXPENSE: (expense._max.sortOrder ?? -1) + 1,
  };
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
  // retirementAge rides along on the ownership check the function already
  // runs: addRow needs it to end a salary at retirement, and reading it here
  // costs nothing and keeps the exported signature unchanged.
  const owned = await tx.plan.findFirst({
    // deletedAt: null, as every comparable ownership read in plan/actions.ts
    // carries: a deleted plan is not a plan to write onto.
    where: { id: planId, userId, deletedAt: null },
    select: { id: true, retirementAge: true },
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

  // Read after the removals above, so a row this Sync deleted does not hold a
  // sortOrder open. Incremented in memory from there, keeping the additions
  // deterministic — and in resolution order — within one run.
  const sortOrders = await nextSortOrders(tx, planId);
  for (const addition of plan.additions) {
    await addRow(
      tx,
      planId,
      addition,
      owned.retirementAge,
      sortOrders[addition.kind]++,
    );
  }
}

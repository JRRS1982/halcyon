// src/lib/plan/reality.ts
//
// Reads the "reality" side of a Sync: the latest observed value per live
// account and per budget category, scoped to one user. I/O, not pure logic —
// resolvePlanSync (src/lib/plan/sync.ts) stays free of this.

import type { AccountKind } from "@prisma/client";
import type { RealityRow } from "@/lib/plan/sync";
import { prisma } from "@/lib/prisma";

function accountKindToPlanRowKind(kind: AccountKind): "ASSET" | "LIABILITY" {
  switch (kind) {
    case "ASSET":
      return "ASSET";
    case "LIABILITY":
      return "LIABILITY";
    case "NONE":
      // Excluded by the query below (kind: { not: "NONE" }); reaching this is
      // a bug in that filter, not a value we should silently coerce.
      throw new Error("kind: NONE accounts are not plan rows");
  }
}

async function latestAccountRows(userId: string): Promise<RealityRow[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null, kind: { not: "NONE" } },
    select: { id: true, name: true, kind: true, wrapper: true },
  });

  const rows = await Promise.all(
    accounts.map(async (account) => {
      // Secondary order on createdAt: two periods can share a startDate (a
      // MONTH and a YEAR period collide on that value), and nothing stops two
      // BalanceItem rows for the same account inside one period. Without a
      // tiebreaker the winner is whatever order Postgres happens to return.
      const latest = await prisma.balanceItem.findFirst({
        where: {
          accountId: account.id,
          deletedAt: null,
          period: { userId, deletedAt: null },
        },
        orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
        select: { value: true },
      });
      // No observation at all: skipped, not added with zero.
      if (!latest) return null;

      const row: RealityRow = {
        linkId: account.id,
        kind: accountKindToPlanRowKind(account.kind),
        label: account.name,
        value: Number(latest.value),
        // The wrapper enum is asset-only (no PlanLiability.wrapper exists),
        // so a liability account's row carries null regardless of what its
        // Account.wrapper column happens to hold. An ASSET account with no
        // stated wrapper (not reachable through the Add drawer, which always
        // sets one, but not DB-enforced) falls back to PlanAsset's own
        // schema default here rather than surfacing null — otherwise a
        // repeat Sync would see reality as "null" forever while the row it
        // wrote last time reads back "OTHER", flagging a false update on
        // every subsequent Sync.
        wrapper: account.kind === "ASSET" ? (account.wrapper ?? "OTHER") : null,
      };
      return row;
    }),
  );

  return rows.filter((row): row is RealityRow => row !== null);
}

async function latestCategoryRows(userId: string): Promise<RealityRow[]> {
  const categories = await prisma.category.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, label: true, type: true },
  });

  const rows = await Promise.all(
    categories.map(async (category) => {
      const latest = await prisma.financialItem.findFirst({
        where: {
          categoryId: category.id,
          deletedAt: null,
          // × 12 below assumes a monthly figure — a YEAR period would
          // otherwise inflate the annualised value twelvefold.
          period: { userId, deletedAt: null, granularity: "MONTH" },
        },
        orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
        select: { budget: true },
      });
      // No budget row at all: skipped, not added with zero.
      if (!latest) return null;

      const row: RealityRow = {
        linkId: category.id,
        // ItemType's members ("INCOME" | "EXPENSE") are a subset of
        // PlanRowKind's, so this is a direct, cast-free assignment.
        kind: category.type,
        label: category.label,
        value: Number(latest.budget) * 12,
        wrapper: null,
      };
      return row;
    }),
  );

  return rows.filter((row): row is RealityRow => row !== null);
}

// One RealityRow per live account and per budget category, each carrying its
// most recent observed value. "Latest" means the most recent non-deleted
// period that has a row for it — not necessarily the current month.
export async function latestReality(userId: string): Promise<RealityRow[]> {
  const [accountRows, categoryRows] = await Promise.all([
    latestAccountRows(userId),
    latestCategoryRows(userId),
  ]);
  return [...accountRows, ...categoryRows];
}

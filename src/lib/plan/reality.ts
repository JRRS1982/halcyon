// src/lib/plan/reality.ts
//
// Reads the "reality" side of a Sync: the latest observed value per live
// account and per budget category, scoped to one user. I/O, not pure logic —
// resolvePlanSync (src/lib/plan/sync.ts) stays free of this.

import type { AccountKind, ItemType } from "@prisma/client";
import type { PlanRowKind, RealityRow } from "@/lib/plan/sync";
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

function itemTypeToPlanRowKind(type: ItemType): PlanRowKind {
  return type;
}

async function latestAccountRows(userId: string): Promise<RealityRow[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null, kind: { not: "NONE" } },
    select: { id: true, name: true, kind: true },
  });

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const latest = await prisma.balanceItem.findFirst({
        where: {
          accountId: account.id,
          deletedAt: null,
          period: { userId, deletedAt: null },
        },
        orderBy: { period: { startDate: "desc" } },
        select: { value: true },
      });
      // No observation at all: skipped, not added with zero.
      if (!latest) return null;

      const row: RealityRow = {
        linkId: account.id,
        kind: accountKindToPlanRowKind(account.kind),
        label: account.name,
        value: Number(latest.value),
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
          period: { userId, deletedAt: null },
        },
        orderBy: { period: { startDate: "desc" } },
        select: { budget: true },
      });
      // No budget row at all: skipped, not added with zero.
      if (!latest) return null;

      const row: RealityRow = {
        linkId: category.id,
        kind: itemTypeToPlanRowKind(category.type),
        label: category.label,
        value: Number(latest.budget) * 12,
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

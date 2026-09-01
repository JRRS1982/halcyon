// src/lib/plan/reality.ts
//
// Reads the "reality" side of a Sync: the latest observed value per live
// account and per budget category, scoped to one user. I/O, not pure logic —
// resolvePlanSync (src/lib/plan/sync.ts) stays free of this.
//
// Every live account is a row, observed or not — an account is a fact about
// what the user owns from the moment it's created, independent of whether a
// balance sheet has ever recorded a value for it. "Latest per key" (per
// account, per (account, flow type), per category) is picked by Postgres
// itself via `DISTINCT ON`, not fetched-then-reduced in memory: a
// default-seeded user (6 accounts, 41 categories) cost 55 round trips the old
// way, fetching every historical row just to keep the newest — and /plan
// re-runs all of it on every router.refresh().

import type { Prisma, TransferDirection } from "@prisma/client";
import { kindOf, wrapperOf } from "@/lib/accounts/accountDraft";
import { isExpenseSection } from "@/lib/categories/sections";
import { drawdownPriorityFor, incomeKindFor } from "@/lib/plan/realityDefaults";
import type { RealityRow } from "@/lib/plan/sync";
import { prisma } from "@/lib/prisma";

// The most recent (by period startDate, then createdAt) BalanceItem value per
// account. Decimal, not number, because $queryRaw deserialises `numeric`
// columns the same way the ORM does.
type LatestValueRow = { accountId: string; value: Prisma.Decimal };

// The budget row an account's flow is read from. Keyed on (accountId, type)
// in SQL, matching flowKey below: an asset holding a stray REPAYMENT
// alongside its TRANSFER must still read its TRANSFER, exactly as the old
// per-account query (which filtered on one type) did.
type LatestFlowRow = {
  accountId: string;
  type: string;
  direction: TransferDirection | null;
  budget: Prisma.Decimal;
};

type LatestBudgetRow = { categoryId: string; budget: Prisma.Decimal };

// What the budget says is flowing into an account, in the unit the plan column
// for it is stored in.
//
// The plan reads the *budgeted* figure, not the actual: it is a forecast of
// what you intend to pay in, not a record of what you did.
//
// `latest` is looked up by the *target* kind rather than by trusting a row's
// own type, so a REPAYMENT can never be annualised nor a TRANSFER left
// monthly — a mispaired row is simply unfindable. The Add drawer's fence
// (requireAnchorAccount) already pairs them that way, and one account carries
// at most one row per period (requireAccountUnbudgeted), so there is exactly
// one row to find rather than a sum.
//
// Zero, never null, when nothing is budgeted: PlanAsset.annualContribution and
// PlanLiability.monthlyRepayment both default to 0, so a null here would never
// compare equal and every unbudgeted account would read as changed on every
// Sync. See RealityRow.flow.
function budgetedFlow(
  latest:
    | { direction: TransferDirection | null; budget: Prisma.Decimal }
    | undefined,
  kind: "ASSET" | "LIABILITY",
): number {
  if (!latest) return 0;

  // A repayment is always inward to the debt and carries no direction.
  // monthlyRepayment is monthly because liabilityStep does its own × 12 —
  // each column is stored in the unit its own drawer displays.
  if (kind === "LIABILITY") return Number(latest.budget);

  // A withdrawal is not a contribution. TRANSFER OUTFLOW has no plan wiring —
  // the projection derives withdrawals from deficits — so it reads as zero
  // rather than paying money into the asset it came out of.
  if (latest.direction !== "INFLOW") return 0;

  // Rounded to 2dp for the same reason latestCategoryRows rounds: £833.33 × 12
  // is 9999.960000000001 in IEEE-754 and 9999.96 in the numeric(12,2) column,
  // so an unrounded read would report this row as an update forever.
  return Math.round(Number(latest.budget) * 1200) / 100;
}

// A flow is keyed on the pair, not the account alone: see LatestFlowRow.
const flowKey = (accountId: string, itemType: string) =>
  `${accountId}:${itemType}`;

async function latestAccountRows(userId: string): Promise<RealityRow[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      section: true,
    },
  });
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((account) => account.id);

  // Both fences the per-row queries carried, kept: `accountId = ANY(...)` can
  // only hold ids from the userId-filtered query above, and `p."userId"`
  // stops a foreign period feeding one of this user's own accounts. Per
  // ADR-002 the server Prisma role bypasses RLS, so these are the only fence.
  const [latestValues, latestFlows] = await Promise.all([
    prisma.$queryRaw<LatestValueRow[]>`
      SELECT DISTINCT ON (b."accountId") b."accountId", b."value"
      FROM "BalanceItem" b
      JOIN "FinancialPeriod" p ON p."id" = b."periodId"
      WHERE b."accountId" = ANY(${accountIds}::uuid[])
        AND b."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."userId" = ${userId}::uuid
      ORDER BY b."accountId", p."startDate" DESC, b."createdAt" DESC
    `,
    // × 12 in budgetedFlow assumes a monthly figure, and a REPAYMENT is
    // stored monthly too — a YEAR period would misread as both.
    prisma.$queryRaw<LatestFlowRow[]>`
      SELECT DISTINCT ON (b."accountId", b."type") b."accountId", b."type", b."direction", b."budget"
      FROM "BudgetItem" b
      JOIN "FinancialPeriod" p ON p."id" = b."periodId"
      WHERE b."accountId" = ANY(${accountIds}::uuid[])
        AND b."type" IN ('TRANSFER', 'REPAYMENT')
        AND b."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."userId" = ${userId}::uuid
        AND p."granularity" = 'MONTH'
      ORDER BY b."accountId", b."type", p."startDate" DESC, b."createdAt" DESC
    `,
  ]);

  const valueByAccount = new Map(
    latestValues.map((row) => [row.accountId, row.value]),
  );
  const flowByKey = new Map(
    latestFlows.map((row) => [flowKey(row.accountId, row.type), row]),
  );

  return accounts.map((account) => {
    // Both fields below key off the *derived* kind rather than trusting the
    // stored mirror column: kindOf comes from the one stored fact (type), and
    // a new AccountType that maps to ASSET would then break the option table
    // loudly instead of falling through these ternaries quietly.
    const kind = kindOf(account.type);
    const value = valueByAccount.get(account.id);

    return {
      linkId: account.id,
      kind,
      label: account.name,
      // No observation at all reads as zero, not skipped: an account is a
      // plan row from the moment it exists.
      value: value === undefined ? 0 : Number(value),
      // The wrapper enum is asset-only (no PlanLiability.wrapper exists), so a
      // liability account's row carries null. wrapperOf is derived from the
      // stored type and never null for an asset type, so there is no
      // fallback left to apply.
      wrapper: kind === "ASSET" ? wrapperOf(account.type) : null,
      flow: budgetedFlow(
        flowByKey.get(
          flowKey(account.id, kind === "ASSET" ? "TRANSFER" : "REPAYMENT"),
        ),
        kind,
      ),
      defaults: {
        // Drawdown is an asset-only concept; PlanLiability has no such column.
        drawdownPriority:
          kind === "ASSET" ? drawdownPriorityFor(account.section) : null,
        incomeKind: null,
        expenseSection: null,
      },
    };
  });
}

async function latestCategoryRows(userId: string): Promise<RealityRow[]> {
  const categories = await prisma.category.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      label: true,
      type: true,
      section: true,
    },
  });
  if (categories.length === 0) return [];

  const categoryIds = categories.map((category) => category.id);

  const latestBudgets = await prisma.$queryRaw<LatestBudgetRow[]>`
    SELECT DISTINCT ON (b."categoryId") b."categoryId", b."budget"
    FROM "BudgetItem" b
    JOIN "FinancialPeriod" p ON p."id" = b."periodId"
    WHERE b."categoryId" = ANY(${categoryIds}::uuid[])
      AND b."type" IN ('INCOME', 'EXPENSE')
      AND b."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."userId" = ${userId}::uuid
      AND p."granularity" = 'MONTH'
    ORDER BY b."categoryId", p."startDate" DESC, b."createdAt" DESC
  `;

  const latestBudget = new Map(
    latestBudgets.map((row) => [row.categoryId, row.budget]),
  );

  const rows: RealityRow[] = [];
  for (const category of categories) {
    const latest = latestBudget.get(category.id);
    // No budget row at all: skipped, not added with zero. Unlike an account,
    // a category is not a durable registry of ownership — it only becomes a
    // plan row once the budget has actually said something about it.
    if (latest === undefined) continue;

    rows.push({
      linkId: category.id,
      kind: category.type,
      label: category.label,
      // Rounded to 2dp, not left as the raw product: budget and
      // annualAmount are both numeric(_,2), so the × 12 happens in doubles
      // and Postgres stores the rounded figure. £833.33 × 12 is
      // 9999.960000000001 in IEEE-754 and 9999.96 in the column — compared
      // unrounded in resolvePlanSync, that row reads as an update forever.
      value: Math.round(Number(latest) * 1200) / 100,
      wrapper: null,
      // A category is not an account: there is no PlanIncome/PlanExpense
      // column for money to flow into, so this row never carries one.
      flow: null,
      defaults: {
        drawdownPriority: null,
        incomeKind:
          category.type === "INCOME" ? incomeKindFor(category.section) : null,
        // PlanExpense.section is nullable; only an expense section may land
        // there, and the check constraint on Category guarantees an EXPENSE
        // category carries one.
        expenseSection:
          category.type === "EXPENSE" && isExpenseSection(category.section)
            ? category.section
            : null,
      },
    });
  }

  return rows;
}

// One RealityRow per live account and per budget category, each carrying its
// most recent observed value. "Latest" means the most recent non-deleted
// period that has a row for it — not necessarily the current month. An
// account with no observation at all still gets a row, at value 0.
export async function latestReality(userId: string): Promise<RealityRow[]> {
  const [accountRows, categoryRows] = await Promise.all([
    latestAccountRows(userId),
    latestCategoryRows(userId),
  ]);
  return [...accountRows, ...categoryRows];
}

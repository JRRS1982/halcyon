// src/lib/plan/reality.ts
//
// Reads the "reality" side of a Sync: the latest observed value per live
// account and per budget category, scoped to one user. I/O, not pure logic —
// resolvePlanSync (src/lib/plan/sync.ts) stays free of this.
//
// Five queries, not one per row. Each concern is fetched with a single
// `findMany` over every id at once, ordered exactly as the old per-row
// `findFirst` was, and the winner per key is picked in memory by latestByKey.
// A default-seeded user (6 accounts, 41 categories) cost 55 round trips that
// way — and /plan re-runs all of them on every router.refresh().

import type { AccountKind, Prisma, TransferDirection } from "@prisma/client";
import { latestByKey } from "@/lib/plan/latestByKey";
import { drawdownPriorityFor, incomeKindFor } from "@/lib/plan/realityDefaults";
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

// The budget row an account's flow is read from. Only the two columns the
// arithmetic below needs — the rest of the row is never looked at.
type FlowRow = {
  direction: TransferDirection | null;
  budget: Prisma.Decimal;
};

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
  latest: FlowRow | undefined,
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

// A flow is keyed on the pair, not the account alone: an asset holding a stray
// REPAYMENT alongside its TRANSFER must still read its TRANSFER, exactly as
// the old per-account query (which filtered on one type) did.
const flowKey = (accountId: string, itemType: string) =>
  `${accountId}:${itemType}`;

async function latestAccountRows(userId: string): Promise<RealityRow[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null, kind: { not: "NONE" } },
    select: {
      id: true,
      name: true,
      kind: true,
      wrapper: true,
      category: true,
    },
  });
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((account) => account.id);

  // Both fences the per-row queries carried, kept: `accountId in` can only
  // hold ids from the userId-filtered query above, and `period: { userId }`
  // stops a foreign period feeding one of this user's own accounts. Per
  // ADR-002 the server Prisma role bypasses RLS, so these are the only fence.
  const [balances, flows] = await Promise.all([
    prisma.balanceItem.findMany({
      where: {
        accountId: { in: accountIds },
        deletedAt: null,
        period: { userId, deletedAt: null },
      },
      // Secondary order on createdAt: two periods can share a startDate (a
      // MONTH and a YEAR period collide on that value), and nothing stops two
      // BalanceItem rows for the same account inside one period. Without a
      // tiebreaker the winner is whatever order Postgres happens to return.
      orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
      select: { accountId: true, value: true },
    }),
    prisma.budgetItem.findMany({
      where: {
        accountId: { in: accountIds },
        deletedAt: null,
        type: { in: ["TRANSFER", "REPAYMENT"] },
        // × 12 in budgetedFlow assumes a monthly figure, and a REPAYMENT is
        // stored monthly too — a YEAR period would misread as both.
        period: { userId, deletedAt: null, granularity: "MONTH" },
      },
      orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
      select: {
        accountId: true,
        type: true,
        direction: true,
        budget: true,
      },
    }),
  ]);

  const latestBalance = latestByKey(balances, (row) => row.accountId);
  const latestFlow = latestByKey(flows, (row) =>
    row.accountId === null ? null : flowKey(row.accountId, row.type),
  );

  const rows: RealityRow[] = [];
  for (const account of accounts) {
    const latest = latestBalance.get(account.id);
    // No observation at all: skipped, not added with zero.
    if (!latest) continue;

    // Both fields below key off the *mapped* kind rather than re-testing
    // account.kind: a new AccountKind that maps to ASSET would then break
    // the switch loudly instead of falling through these ternaries quietly.
    const kind = accountKindToPlanRowKind(account.kind);

    rows.push({
      linkId: account.id,
      kind,
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
      wrapper: kind === "ASSET" ? (account.wrapper ?? "OTHER") : null,
      flow: budgetedFlow(
        latestFlow.get(
          flowKey(account.id, kind === "ASSET" ? "TRANSFER" : "REPAYMENT"),
        ),
        kind,
      ),
      defaults: {
        // Drawdown is an asset-only concept; PlanLiability has no such column.
        drawdownPriority:
          kind === "ASSET" ? drawdownPriorityFor(account.category) : null,
        incomeKind: null,
        expenseCategory: null,
      },
    });
  }

  return rows;
}

async function latestCategoryRows(userId: string): Promise<RealityRow[]> {
  const categories = await prisma.category.findMany({
    // Categories are never transfers or repayments — those key on accounts,
    // not categories — so this excludes the widened ItemType members that
    // can never actually appear on a Category row.
    where: { userId, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } },
    select: {
      id: true,
      label: true,
      type: true,
      incomeCategory: true,
      category: true,
      // The debt this category pays off, when it says so — see below.
      accountId: true,
    },
  });
  if (categories.length === 0) return [];

  const budgets = await prisma.budgetItem.findMany({
    where: {
      categoryId: { in: categories.map((category) => category.id) },
      deletedAt: null,
      // The double-count guarantee, enforced rather than inferred. It
      // rests on "a row with a categoryId is never a TRANSFER or a
      // REPAYMENT", which holds by construction across every write path
      // today — but this query would otherwise take whatever type it
      // found, and a future write path that broke the invariant would
      // double-count silently: once on the account's flow, once here as
      // an income or expense. budgetedFlow already keys off type; this is
      // the matching half.
      type: { in: ["INCOME", "EXPENSE"] },
      // × 12 below assumes a monthly figure — a YEAR period would
      // otherwise inflate the annualised value twelvefold.
      period: { userId, deletedAt: null, granularity: "MONTH" },
    },
    orderBy: [{ period: { startDate: "desc" } }, { createdAt: "desc" }],
    select: { categoryId: true, budget: true },
  });

  const latestBudget = latestByKey(budgets, (row) => row.categoryId);

  // Accounts that already carry a payment of their own.
  //
  // An expense category that declares itself the payment for one of these is
  // the SAME money as that account's repayment row, and counting both is the
  // mortgage double-count: £30,000/yr of outflow for one £15,000 payment,
  // silently, because keeping the old expense row is the natural thing to do
  // when adding a repayment.
  //
  // Only when a repayment actually exists. The link says "I am this account's
  // payment", so with nothing else carrying it, dropping the expense would
  // lose the money rather than de-duplicate it — and a value that quietly
  // stops travelling is the failure this codebase keeps producing.
  //
  // Never inferred from the label: "Mortgage" beside an account called
  // "Halifax mortgage" is a guess, and a guess here deletes real spending
  // from someone's forecast.
  const declaredAccountIds = categories.flatMap((c) =>
    c.accountId ? [c.accountId] : [],
  );
  const paidByRepayment = new Set(
    declaredAccountIds.length === 0
      ? []
      : (
          await prisma.budgetItem.findMany({
            where: {
              accountId: { in: declaredAccountIds },
              type: "REPAYMENT",
              deletedAt: null,
              period: { userId, deletedAt: null, granularity: "MONTH" },
            },
            select: { accountId: true },
          })
        ).flatMap((row) => (row.accountId ? [row.accountId] : [])),
  );

  const rows: RealityRow[] = [];
  for (const category of categories) {
    if (category.accountId && paidByRepayment.has(category.accountId)) continue;
    const latest = latestBudget.get(category.id);
    // No budget row at all: skipped, not added with zero.
    if (!latest) continue;

    // The query's `where` already excludes anything but INCOME/EXPENSE —
    // categories are never transfers or repayments — but ItemType is
    // shared with BudgetItem/BudgetTemplateItem, so the Prisma-generated
    // type for `category.type` is still the full enum. This narrows it
    // back down without a cast; unreachable in practice.
    if (category.type !== "INCOME" && category.type !== "EXPENSE") continue;

    rows.push({
      linkId: category.id,
      kind: category.type,
      label: category.label,
      // Rounded to 2dp, not left as the raw product: budget and
      // annualAmount are both numeric(_,2), so the × 12 happens in doubles
      // and Postgres stores the rounded figure. £833.33 × 12 is
      // 9999.960000000001 in IEEE-754 and 9999.96 in the column — compared
      // unrounded in resolvePlanSync, that row reads as an update forever.
      value: Math.round(Number(latest.budget) * 1200) / 100,
      wrapper: null,
      // A category is not an account: there is no PlanIncome/PlanExpense
      // column for money to flow into, so this row never carries one.
      flow: null,
      defaults: {
        drawdownPriority: null,
        incomeKind:
          category.type === "INCOME"
            ? incomeKindFor(category.incomeCategory)
            : null,
        // PlanExpense.category is nullable, so an uncategorised category
        // stays uncategorised rather than being guessed at.
        expenseCategory: category.type === "EXPENSE" ? category.category : null,
      },
    });
  }

  return rows;
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

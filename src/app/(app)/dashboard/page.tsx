import { redirect } from "next/navigation";
import { currentMonthRange, MONTH_LABELS_SHORT } from "@/lib/budget/period";
import { computeRollups } from "@/lib/budget/totals";
import { isExpenseSection } from "@/lib/categories/sections";
import { monthChecklist } from "@/lib/dashboard/checklist";
import {
  accountBalanceSums,
  type BalanceSums,
  balanceSeries,
  cashFlowSeries,
  type ExpenditurePoint,
  type MonthFlow,
  monthFlow,
} from "@/lib/dashboard/series";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  accountActual,
  amountsByMonthAndCategory,
  isAccountKeyed,
  monthCategoryKey,
  netActual,
} from "@/lib/transactions/actual";
import {
  countUncategorized,
  getTransferFlowByMonthAndAccount,
} from "@/lib/transactions/server";
import { monthAccountKey } from "@/lib/transactions/transfers";
import { DashboardView } from "./DashboardView";

const WINDOW_MONTHS = 12;
const TRAILING = 6;

type Cat = "FIXED" | "VARIABLE" | "DISCRETIONARY";

// Protected by middleware. Pulls the last 12 months of periods and shapes the
// series each dashboard chart needs: monthly cash flow, balance buckets, and
// per-category expenditure (actual/budget/average).
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const { currency, numberFormat, hiddenCharts, transactionsEnabled } =
    await getCurrentUserSettings();

  const now = currentMonthRange();
  const windowStart = new Date(
    Date.UTC(
      now.startDate.getUTCFullYear(),
      now.startDate.getUTCMonth() - (WINDOW_MONTHS - 1),
      1,
    ),
  );

  const periods = await prisma.financialPeriod.findMany({
    where: {
      userId: user.id,
      granularity: "MONTH",
      deletedAt: null,
      startDate: { gte: windowStart },
    },
    orderBy: { startDate: "asc" },
    include: {
      // BalanceItem no longer carries its own type/section columns — the
      // account is the only source, so the sums below join through it.
      balanceItems: {
        where: { deletedAt: null },
        include: { account: { select: { type: true, section: true } } },
      },
      items: { where: { deletedAt: null } },
    },
  });

  const monthLabel = (date: Date) =>
    `${MONTH_LABELS_SHORT[date.getUTCMonth()]} ${String(
      date.getUTCFullYear(),
    ).slice(2)}`;

  // In transactions mode the stored `actual` column is dead data — the budget
  // page computes actuals from transactions as a display overlay and never
  // writes them back. Mirror that overlay here (one query for the whole
  // window) so every chart reports what was actually spent and received.
  const txAmounts = transactionsEnabled
    ? amountsByMonthAndCategory(
        (
          await prisma.transaction.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              categoryId: { not: null },
              date: { gte: windowStart },
            },
            select: { categoryId: true, amount: true, date: true },
          })
        ).flatMap((t) =>
          t.categoryId
            ? [
                {
                  categoryId: t.categoryId,
                  amount: Number(t.amount),
                  date: t.date,
                },
              ]
            : [],
        ),
      )
    : new Map<string, number[]>();

  // The account-keyed half of the same overlay: a TRANSFER/REPAYMENT row's
  // actual is netted by account, not by category, so it needs its own source.
  // Without it a repayment charted 0 in transactions mode however monthFlow
  // classified it — the second of the two exclusions that dropped repayments
  // from the cash-flow chart. Bucketed by month from one query, exactly as the
  // category amounts above are; bounded by the last period loaded, so it spans
  // the same window the charts do.
  const windowEnd = periods.at(-1)?.endDate ?? now.endDate;
  const transferFlow =
    transactionsEnabled &&
    periods.some((p) => p.items.some((i) => isAccountKeyed(i.type)))
      ? await getTransferFlowByMonthAndAccount(user.id, windowStart, windowEnd)
      : new Map<string, number>();

  type OverlayableItem = {
    // Mirrors the full Prisma ItemType enum: a BudgetItem can be any of the
    // four kinds, and each half of the overlay computes only its own — routed
    // on the row's kind rather than on whether an id happens to be set, the
    // same rule the budget page uses.
    type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
    categoryId: string | null;
    accountId: string | null;
    direction: "INFLOW" | "OUTFLOW" | null;
    actual: unknown;
  };
  const actualFor = (periodStart: Date, item: OverlayableItem): number => {
    if (!transactionsEnabled) return Number(item.actual);
    if (isAccountKeyed(item.type))
      return accountActual(
        item.accountId
          ? (transferFlow.get(monthAccountKey(periodStart, item.accountId)) ??
              0)
          : 0,
        item.type,
        item.direction,
      );
    return netActual(
      item.categoryId
        ? (txAmounts.get(monthCategoryKey(periodStart, item.categoryId)) ?? [])
        : [],
      item.type,
    );
  };

  // ─── Balance series: one point per month that has balance data ────────────
  const balanceSums: BalanceSums[] = [];
  for (const p of periods) {
    if (p.balanceItems.length === 0) continue;
    const sums = accountBalanceSums(
      p.balanceItems.map((b) => ({
        value: Number(b.value),
        account: b.account,
      })),
    );
    balanceSums.push({ month: monthLabel(p.startDate), ...sums });
  }
  const balanceData = balanceSeries(balanceSums);

  // ─── Per-category expenditure: actual + budget per month, plus a trailing
  // 6-month average of the actual. ─────────────────────────────────────────
  const monthly: {
    month: string;
    FIXED: { actual: number; budget: number };
    VARIABLE: { actual: number; budget: number };
    DISCRETIONARY: { actual: number; budget: number };
  }[] = [];
  for (const p of periods) {
    if (!p.items.some((i) => i.type === "EXPENSE")) continue;
    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        budget: Number(i.budget),
        actual: actualFor(p.startDate, i),
      })),
    );
    const cat = {
      FIXED: { actual: 0, budget: 0 },
      VARIABLE: { actual: 0, budget: 0 },
      DISCRETIONARY: { actual: 0, budget: 0 },
    };
    for (const it of p.items) {
      if (it.type !== "EXPENSE") continue;
      const r = rollups.get(it.id);
      if (!r) continue;
      const c: Cat =
        it.section !== null && isExpenseSection(it.section)
          ? it.section
          : "FIXED";
      cat[c].actual += r.actual;
      cat[c].budget += r.budget;
    }
    monthly.push({ month: monthLabel(p.startDate), ...cat });
  }

  const trailingAvg = (i: number, key: Cat) => {
    const start = Math.max(0, i - (TRAILING - 1));
    const window = monthly.slice(start, i + 1);
    const sum = window.reduce((acc, m) => acc + m[key].actual, 0);
    return sum / window.length;
  };

  const expenditureData: ExpenditurePoint[] = monthly.map((m, i) => ({
    month: m.month,
    fixedActual: m.FIXED.actual,
    fixedBudget: m.FIXED.budget,
    fixedAvg: trailingAvg(i, "FIXED"),
    variableActual: m.VARIABLE.actual,
    variableBudget: m.VARIABLE.budget,
    variableAvg: trailingAvg(i, "VARIABLE"),
    discretionaryActual: m.DISCRETIONARY.actual,
    discretionaryBudget: m.DISCRETIONARY.budget,
    discretionaryAvg: trailingAvg(i, "DISCRETIONARY"),
  }));

  // ─── Cash flow: income vs expense actuals per month ───────────────────────
  const cashFlowInput: MonthFlow[] = [];
  for (const p of periods) {
    // REPAYMENT counts here for the same reason it counts in monthFlow: it is
    // spending, so a month holding only repayments has a cash flow to chart.
    // A TRANSFER is the one kind neither series reads.
    const hasChartedRow = p.items.some((i) => i.type !== "TRANSFER");
    if (!hasChartedRow) continue;

    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        budget: Number(i.budget),
        actual: actualFor(p.startDate, i),
      })),
    );

    const { income, expense } = monthFlow(
      p.items.flatMap((it) => {
        const r = rollups.get(it.id);
        return r ? [{ type: it.type, actual: r.actual }] : [];
      }),
    );
    cashFlowInput.push({ month: monthLabel(p.startDate), income, expense });
  }
  const cashFlowData = cashFlowSeries(cashFlowInput);

  // ─── This-month checklist: the monthly loop as state ──────────────────────
  // Derived almost entirely from the periods already loaded; the only extra
  // read is the uncategorized count, and only in transactions mode.
  const currentPeriod = periods.find(
    (p) => p.startDate.getTime() === now.startDate.getTime(),
  );
  const checklist = monthChecklist({
    transactionsEnabled,
    hasBudgetItems: (currentPeriod?.items.length ?? 0) > 0,
    // Any live value this month — the query above already scopes
    // balanceItems to deletedAt: null, so a row surviving here is a real
    // observation, not a stale or archived-account leftover.
    hasBalanceItems: (currentPeriod?.balanceItems.length ?? 0) > 0,
    uncategorizedCount: transactionsEnabled
      ? await countUncategorized(user.id)
      : 0,
  });

  return (
    <DashboardView
      balanceData={balanceData}
      expenditureData={expenditureData}
      cashFlowData={cashFlowData}
      currency={currency}
      numberFormat={numberFormat}
      hiddenCharts={hiddenCharts}
      checklist={checklist}
      checklistMonth={now.label}
    />
  );
}

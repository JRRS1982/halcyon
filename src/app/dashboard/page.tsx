import { MONTH_LABELS_SHORT, currentMonthRange } from "@/lib/budget/period";
import { computeRollups } from "@/lib/budget/totals";
import {
  type BudgetActualPoint,
  type MonthFlow,
  budgetVsActualTrend,
  cashFlowSeries,
  composition,
  netWorthSeries,
} from "@/lib/dashboard/series";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { BalancePoint } from "./BalanceTrendChart";
import type { CategoryBudgetActual } from "./BudgetVsActualChart";
import { DashboardView } from "./DashboardView";
import type { ExpenditurePoint } from "./ExpenditureChart";

const WINDOW_MONTHS = 12;

// Protected by middleware. Pulls the last 12 months of periods and shapes two
// series: balance buckets over time, and average actual spend per expense
// category.
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const { currency, numberFormat } = await getCurrentUserSettings();

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
      balanceItems: { where: { deletedAt: null } },
      items: { where: { deletedAt: null } },
    },
  });

  // ─── Balance series: one point per month that has balance data ────────────
  const balanceData: BalancePoint[] = [];
  for (const p of periods) {
    if (p.balanceItems.length === 0) continue;
    const sums = {
      assetCurrent: 0,
      assetLongTerm: 0,
      assetOther: 0,
      liabilityCurrent: 0,
      liabilityLongTerm: 0,
      liabilityOther: 0,
    };
    for (const b of p.balanceItems) {
      const v = Number(b.value);
      if (b.type === "ASSET") {
        if (b.category === "CURRENT") sums.assetCurrent += v;
        else if (b.category === "LONG_TERM") sums.assetLongTerm += v;
        else sums.assetOther += v;
      } else {
        if (b.category === "CURRENT") sums.liabilityCurrent += v;
        else if (b.category === "LONG_TERM") sums.liabilityLongTerm += v;
        else sums.liabilityOther += v;
      }
    }
    const m = p.startDate.getUTCMonth();
    const yy = String(p.startDate.getUTCFullYear()).slice(2);
    balanceData.push({ month: `${MONTH_LABELS_SHORT[m]} ${yy}`, ...sums });
  }

  // ─── Expenditure over time: per-category actual + trailing-6-month average ─
  // First, each month (that has expense data) and its per-category actuals.
  const monthly: {
    month: string;
    FIXED: number;
    VARIABLE: number;
    DISCRETIONARY: number;
  }[] = [];
  for (const p of periods) {
    if (!p.items.some((i) => i.type === "EXPENSE")) continue;
    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        parentItemId: i.parentItemId,
        budget: Number(i.budget),
        actual: Number(i.actual),
      })),
    );
    const cat = { FIXED: 0, VARIABLE: 0, DISCRETIONARY: 0 };
    for (const it of p.items) {
      if (it.type !== "EXPENSE" || it.parentItemId !== null) continue;
      const r = rollups.get(it.id);
      if (!r) continue;
      cat[it.category ?? "FIXED"] += r.actual;
    }
    const m = p.startDate.getUTCMonth();
    const yy = String(p.startDate.getUTCFullYear()).slice(2);
    monthly.push({ month: `${MONTH_LABELS_SHORT[m]} ${yy}`, ...cat });
  }

  // Trailing average over the last 6 recorded months (inclusive), so it shifts
  // with recent spending instead of being one flat number.
  const TRAILING = 6;
  const trailingAvg = (
    i: number,
    key: "FIXED" | "VARIABLE" | "DISCRETIONARY",
  ) => {
    const start = Math.max(0, i - (TRAILING - 1));
    const window = monthly.slice(start, i + 1);
    const sum = window.reduce((acc, m) => acc + m[key], 0);
    return sum / window.length;
  };

  const expenditureData: ExpenditurePoint[] = monthly.map((m, i) => ({
    month: m.month,
    fixedActual: m.FIXED,
    fixedAvg: trailingAvg(i, "FIXED"),
    variableActual: m.VARIABLE,
    variableAvg: trailingAvg(i, "VARIABLE"),
    discretionaryActual: m.DISCRETIONARY,
    discretionaryAvg: trailingAvg(i, "DISCRETIONARY"),
  }));

  // ─── Cash flow, budget-vs-actual, composition ─────────────────────────────
  // A second pass over the same periods shaping the inputs the new charts need.
  // Net worth reuses the balance buckets already summed above.
  const cashFlowInput: MonthFlow[] = [];
  const budgetActualByMonth: BudgetActualPoint[] = [];
  let latestCategories: CategoryBudgetActual[] = [];
  let latestComposition: {
    fixed: number;
    variable: number;
    discretionary: number;
  } | null = null;

  for (const p of periods) {
    const hasIncome = p.items.some((i) => i.type === "INCOME");
    const hasExpense = p.items.some((i) => i.type === "EXPENSE");
    if (!hasIncome && !hasExpense) continue;

    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        parentItemId: i.parentItemId,
        budget: Number(i.budget),
        actual: Number(i.actual),
      })),
    );

    let income = 0;
    let expenseBudget = 0;
    let expenseActual = 0;
    const cat = {
      FIXED: { budget: 0, actual: 0 },
      VARIABLE: { budget: 0, actual: 0 },
      DISCRETIONARY: { budget: 0, actual: 0 },
    };
    for (const it of p.items) {
      if (it.parentItemId !== null) continue;
      const r = rollups.get(it.id);
      if (!r) continue;
      if (it.type === "INCOME") {
        income += r.actual;
        continue;
      }
      expenseBudget += r.budget;
      expenseActual += r.actual;
      const c = it.category ?? "FIXED";
      cat[c].budget += r.budget;
      cat[c].actual += r.actual;
    }

    const m = p.startDate.getUTCMonth();
    const yy = String(p.startDate.getUTCFullYear()).slice(2);
    const month = `${MONTH_LABELS_SHORT[m]} ${yy}`;

    cashFlowInput.push({ month, income, expense: expenseActual });
    if (hasExpense) {
      budgetActualByMonth.push({
        month,
        budget: expenseBudget,
        actual: expenseActual,
      });
      // Overwritten each expense month, so it ends on the latest one.
      latestCategories = [
        {
          category: "Fixed",
          budget: cat.FIXED.budget,
          actual: cat.FIXED.actual,
        },
        {
          category: "Variable",
          budget: cat.VARIABLE.budget,
          actual: cat.VARIABLE.actual,
        },
        {
          category: "Discretionary",
          budget: cat.DISCRETIONARY.budget,
          actual: cat.DISCRETIONARY.actual,
        },
      ];
      latestComposition = {
        fixed: cat.FIXED.actual,
        variable: cat.VARIABLE.actual,
        discretionary: cat.DISCRETIONARY.actual,
      };
    }
  }

  const netWorthData = netWorthSeries(balanceData);
  const cashFlowData = cashFlowSeries(cashFlowInput);
  const budgetTrend = budgetVsActualTrend(budgetActualByMonth);
  const compositionData = latestComposition
    ? composition(latestComposition)
    : [];

  return (
    <DashboardView
      balanceData={balanceData}
      expenditureData={expenditureData}
      netWorthData={netWorthData}
      cashFlowData={cashFlowData}
      budgetCategories={latestCategories}
      budgetTrend={budgetTrend}
      compositionData={compositionData}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
}

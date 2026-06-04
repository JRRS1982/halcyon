import { MONTH_LABELS_SHORT, currentMonthRange } from "@/lib/budget/period";
import { computeRollups } from "@/lib/budget/totals";
import {
  type BalanceSums,
  type ExpenditurePoint,
  type MonthFlow,
  balanceSeries,
  cashFlowSeries,
} from "@/lib/dashboard/series";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardView } from "./DashboardView";

const WINDOW_MONTHS = 12;
const TRAILING = 6;

type Cat = "FIXED" | "VARIABLE" | "DISCRETIONARY";

// Protected by middleware. Pulls the last 12 months of periods and shapes the
// series each dashboard chart needs: monthly cash flow, balance buckets, and
// per-category expenditure (actual/budget/average).
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const { currency, numberFormat, hiddenCharts } =
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
      balanceItems: { where: { deletedAt: null } },
      items: { where: { deletedAt: null } },
    },
  });

  const monthLabel = (date: Date) =>
    `${MONTH_LABELS_SHORT[date.getUTCMonth()]} ${String(
      date.getUTCFullYear(),
    ).slice(2)}`;

  // ─── Balance series: one point per month that has balance data ────────────
  const balanceSums: BalanceSums[] = [];
  for (const p of periods) {
    if (p.balanceItems.length === 0) continue;
    const sums = {
      assetCurrent: 0,
      assetMediumTerm: 0,
      assetLongTerm: 0,
      assetProperty: 0,
      assetOther: 0,
      liabilityCurrent: 0,
      liabilityMediumTerm: 0,
      liabilityLongTerm: 0,
      liabilityOther: 0,
    };
    for (const b of p.balanceItems) {
      const v = Number(b.value);
      if (b.type === "ASSET") {
        if (b.category === "CURRENT") sums.assetCurrent += v;
        else if (b.category === "MEDIUM_TERM") sums.assetMediumTerm += v;
        else if (b.category === "LONG_TERM") sums.assetLongTerm += v;
        else if (b.category === "PROPERTY") sums.assetProperty += v;
        else sums.assetOther += v;
      } else {
        if (b.category === "CURRENT") sums.liabilityCurrent += v;
        else if (b.category === "MEDIUM_TERM") sums.liabilityMediumTerm += v;
        else if (b.category === "LONG_TERM") sums.liabilityLongTerm += v;
        // PROPERTY is asset-only in the UI; if a stray LIABILITY:PROPERTY
        // ever exists in data, fold it into Other rather than dropping it.
        else sums.liabilityOther += v;
      }
    }
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
        actual: Number(i.actual),
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
      const c: Cat = it.category ?? "FIXED";
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
    const hasIncome = p.items.some((i) => i.type === "INCOME");
    const hasExpense = p.items.some((i) => i.type === "EXPENSE");
    if (!hasIncome && !hasExpense) continue;

    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        budget: Number(i.budget),
        actual: Number(i.actual),
      })),
    );

    let income = 0;
    let expense = 0;
    for (const it of p.items) {
      const r = rollups.get(it.id);
      if (!r) continue;
      if (it.type === "INCOME") income += r.actual;
      else expense += r.actual;
    }
    cashFlowInput.push({ month: monthLabel(p.startDate), income, expense });
  }
  const cashFlowData = cashFlowSeries(cashFlowInput);

  return (
    <DashboardView
      balanceData={balanceData}
      expenditureData={expenditureData}
      cashFlowData={cashFlowData}
      currency={currency}
      numberFormat={numberFormat}
      hiddenCharts={hiddenCharts}
    />
  );
}

import { MONTH_LABELS_SHORT, currentMonthRange } from "@/lib/budget/period";
import { computeRollups } from "@/lib/budget/totals";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { BalancePoint } from "./BalanceTrendChart";
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

  // ─── Expenditure: average actual per expense category over tracked months ──
  const catTotals = { FIXED: 0, VARIABLE: 0, DISCRETIONARY: 0 };
  let expenseMonths = 0;
  for (const p of periods) {
    if (!p.items.some((i) => i.type === "EXPENSE")) continue;
    expenseMonths++;
    const rollups = computeRollups(
      p.items.map((i) => ({
        id: i.id,
        type: i.type,
        parentItemId: i.parentItemId,
        budget: Number(i.budget),
        actual: Number(i.actual),
      })),
    );
    for (const it of p.items) {
      if (it.type !== "EXPENSE" || it.parentItemId !== null) continue;
      const r = rollups.get(it.id);
      if (!r) continue;
      catTotals[it.category ?? "FIXED"] += r.actual;
    }
  }
  const expenditureData: ExpenditurePoint[] =
    expenseMonths === 0
      ? []
      : [
          { category: "Fixed", average: catTotals.FIXED / expenseMonths },
          { category: "Variable", average: catTotals.VARIABLE / expenseMonths },
          {
            category: "Discretionary",
            average: catTotals.DISCRETIONARY / expenseMonths,
          },
        ];

  return (
    <DashboardView
      balanceData={balanceData}
      expenditureData={expenditureData}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
}

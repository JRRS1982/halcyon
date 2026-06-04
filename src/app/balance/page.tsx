import {
  currentMonthRange,
  formatYm,
  monthRangeFor,
  parseYm,
} from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  BalanceSheet,
  type SerializedBalanceItem,
  type SerializedPeriod,
} from "./BalanceSheet";

type PageProps = {
  searchParams: Promise<{ ym?: string }>;
};

// /balance shares the FinancialPeriod row with /budget for a given month
// (?ym=YYYY-MM). The period is "virtual" (id="") until either page creates
// its first item — at which point both pages see the real row.
export default async function BalancePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/balance");
  }

  let year: number;
  let month: number;
  if (searchParams.ym) {
    const parsed = parseYm(searchParams.ym);
    if (parsed) {
      ({ year, month } = parsed);
    } else {
      const now = currentMonthRange();
      year = now.startDate.getUTCFullYear();
      month = now.startDate.getUTCMonth();
    }
  } else {
    const now = currentMonthRange();
    year = now.startDate.getUTCFullYear();
    month = now.startDate.getUTCMonth();
  }

  const range = monthRangeFor(year, month);
  const { currency, numberFormat } = await getCurrentUserSettings();

  const period = await prisma.financialPeriod.findUnique({
    where: {
      userId_granularity_startDate: {
        userId: user.id,
        granularity: "MONTH",
        startDate: range.startDate,
      },
    },
  });

  const items = period
    ? await prisma.balanceItem.findMany({
        where: { periodId: period.id, deletedAt: null },
        orderBy: [{ type: "asc" }, { category: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const serializedPeriod: SerializedPeriod = {
    id: period?.id ?? "",
    label: range.label,
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };

  const serializedItems: SerializedBalanceItem[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    category: i.category,
    label: i.label,
    value: Number(i.value),
    notes: i.notes,
    sortOrder: i.sortOrder,
  }));

  const hasTemplate =
    (await prisma.balanceTemplateItem.count({
      where: { userId: user.id, deletedAt: null },
    })) > 0;

  return (
    <BalanceSheet
      key={formatYm(year, month)}
      period={serializedPeriod}
      initialItems={serializedItems}
      year={year}
      month={month}
      currency={currency}
      numberFormat={numberFormat}
      hasTemplate={hasTemplate}
    />
  );
}

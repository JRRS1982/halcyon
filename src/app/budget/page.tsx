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
  BudgetSheet,
  type SerializedItem,
  type SerializedPeriod,
} from "./BudgetSheet";

type PageProps = {
  searchParams: { ym?: string };
};

// Route logic:
//   /budget          → current calendar month
//   /budget?ym=2026-03 → March 2026
//
// Periods are looked up by (userId, MONTH, startDate); if the row doesn't
// exist yet we render a **virtual** period (id="") with no items. The DB
// row is only created when the user adds their first item (see
// BudgetSheet.onAddRow). This avoids leaving an empty FinancialPeriod row
// every time someone rotates through a month they don't end up using.
export default async function BudgetPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/budget");
  }

  // Resolve (year, month) from the URL or fall back to "today".
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

  // Find — don't create.
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
    ? await prisma.financialItem.findMany({
        where: { periodId: period.id, deletedAt: null },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  // Serialise Decimal + Date for the client component (Next.js can't pass
  // those over the RSC boundary directly). For a virtual period we use
  // id="" — BudgetSheet treats that as "no DB row yet, create on first
  // item add".
  const serializedPeriod: SerializedPeriod = {
    id: period?.id ?? "",
    label: range.label,
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };

  const serializedItems: SerializedItem[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    parentItemId: i.parentItemId,
    category: i.category,
    incomeCategory: i.incomeCategory,
    label: i.label,
    budget: Number(i.budget),
    actual: Number(i.actual),
    sortOrder: i.sortOrder,
  }));

  // Whether the user has a saved budget template, so the sheet can show the
  // "★ Template" copy source and the right save-confirm wording.
  const hasTemplate =
    (await prisma.budgetTemplateItem.count({
      where: { userId: user.id, deletedAt: null },
    })) > 0;

  // key on ym forces a fresh component instance per month, so the
  // client's local state (items, periodState, picker) doesn't leak from
  // the previous month.
  return (
    <BudgetSheet
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

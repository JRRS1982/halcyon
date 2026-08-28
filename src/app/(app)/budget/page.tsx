import { redirect } from "next/navigation";
import {
  currentMonthRange,
  formatYm,
  monthRangeFor,
  parseYm,
} from "@/lib/budget/period";
import type { AnchorAccount } from "@/lib/budget/sections";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  accountActual,
  isAccountKeyed,
  netActual,
} from "@/lib/transactions/actual";
import {
  getAmountsByCategory,
  getTransferFlowByAccount,
} from "@/lib/transactions/server";
import {
  BudgetSheet,
  type SerializedItem,
  type SerializedPeriod,
} from "./BudgetSheet";

type PageProps = {
  searchParams: Promise<{ ym?: string }>;
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
export default async function BudgetPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
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
  const { currency, numberFormat, transactionsEnabled } =
    await getCurrentUserSettings();

  // Find — don't create.
  let period = await prisma.financialPeriod.findUnique({
    where: {
      userId_granularity_startDate: {
        userId: user.id,
        granularity: "MONTH",
        startDate: range.startDate,
      },
    },
  });

  let items = period
    ? await prisma.budgetItem.findMany({
        where: { periodId: period.id, deletedAt: null },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  // Force-show: when transactions mode is on, any category with spend this
  // month must appear on the budget. For categories that have transactions but
  // no line item yet, materialise a budget=0 row in the category's own section
  // (type + bucket); the actual is filled by the overlay below. This is what
  // makes categorised spend show up on the budget even if it was never budgeted.
  if (transactionsEnabled) {
    const transacted = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        categoryId: { not: null },
        date: { gte: range.startDate, lte: range.endDate },
      },
      select: { categoryId: true },
      distinct: ["categoryId"],
    });
    const existing = new Set(
      items.map((i) => i.categoryId).filter((id): id is string => id !== null),
    );
    const missingIds = transacted
      .map((t) => t.categoryId)
      .filter((id): id is string => id !== null && !existing.has(id));

    if (missingIds.length > 0) {
      const targetPeriod =
        period ??
        (await prisma.financialPeriod.create({
          data: {
            userId: user.id,
            granularity: "MONTH",
            startDate: range.startDate,
            endDate: range.endDate,
            label: range.label,
          },
        }));
      period = targetPeriod;

      const cats = await prisma.category.findMany({
        where: { id: { in: missingIds }, userId: user.id, deletedAt: null },
        select: {
          id: true,
          type: true,
          category: true,
          incomeCategory: true,
          label: true,
        },
      });
      const baseSort = items.reduce((max, i) => Math.max(max, i.sortOrder), 0);
      await prisma.budgetItem.createMany({
        data: cats.map((c, idx) => ({
          periodId: targetPeriod.id,
          categoryId: c.id,
          type: c.type,
          category: c.category,
          incomeCategory: c.incomeCategory,
          label: c.label,
          budget: 0,
          sortOrder: baseSort + 1 + idx,
        })),
      });
      items = await prisma.budgetItem.findMany({
        where: { periodId: targetPeriod.id, deletedAt: null },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      });
    }
  }

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

  // When transactions mode is on, a category's actual is the net sum of its
  // transactions in this month (see src/lib/transactions/actual.ts) rather than
  // the manually-typed value. The stored `actual` column is left untouched — we
  // only overlay the computed figure for display.
  const amountsByCategory =
    transactionsEnabled && period
      ? await getAmountsByCategory(
          user.id,
          items
            .map((i) => i.categoryId)
            .filter((id): id is string => id !== null),
          range.startDate,
          range.endDate,
        )
      : new Map<string, number[]>();

  // A TRANSFER/REPAYMENT row's actual is netted by account, not by category —
  // one query, and only when there is a row that needs it. Routed on the row's
  // kind rather than on whether it happens to carry an accountId: an accident
  // is not a boundary.
  const transferFlow =
    transactionsEnabled && items.some((i) => isAccountKeyed(i.type))
      ? await getTransferFlowByAccount(user.id, range.startDate, range.endDate)
      : new Map<string, number>();

  const serializedItems: SerializedItem[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    category: i.category,
    incomeCategory: i.incomeCategory,
    categoryId: i.categoryId,
    // The anchor, carried whole. Dropping `direction` here would leave every
    // transfer row reading as an inflow, which mis-signs the month's surplus.
    accountId: i.accountId,
    direction: i.direction,
    label: i.label,
    budget: Number(i.budget),
    actual: transactionsEnabled
      ? isAccountKeyed(i.type)
        ? accountActual(
            transferFlow.get(i.accountId ?? "") ?? 0,
            i.type,
            i.direction,
          )
        : netActual(amountsByCategory.get(i.categoryId ?? "") ?? [], i.type)
      : Number(i.actual),
    sortOrder: i.sortOrder,
  }));

  // Every account the user has, archived ones included: the Add drawer filters
  // this to the kinds a row may target, and an already-anchored row still needs
  // to name an account that has since been archived.
  const accounts: AnchorAccount[] = (
    await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, deletedAt: true },
    })
  ).map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    archived: a.deletedAt !== null,
  }));

  // key on ym forces a fresh component instance per month, so the
  // client's local state (items, periodState, picker) doesn't leak from
  // the previous month.
  return (
    <BudgetSheet
      key={formatYm(year, month)}
      period={serializedPeriod}
      initialItems={serializedItems}
      accounts={accounts}
      year={year}
      month={month}
      currency={currency}
      numberFormat={numberFormat}
      actualsReadOnly={transactionsEnabled}
    />
  );
}

import type { AccountTerms, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { kindOf } from "@/lib/accounts/accountDraft";
import type { AccountTermsInput } from "@/lib/accounts/schemas";
import {
  currentMonthRange,
  formatYm,
  monthRangeFor,
  parseYm,
} from "@/lib/budget/period";
import { accountBalanceSums } from "@/lib/dashboard/series";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  type BalanceMonthSummary,
  BalanceSheet,
  type SerializedAccountRow,
  type SerializedPeriod,
} from "./BalanceSheet";

type PageProps = {
  searchParams: Promise<{ ym?: string }>;
};

// A Prisma.Decimal can't cross into a client component — BalanceSheet (and
// the AccountCard it renders) is "use client", so every AccountTerms decimal
// column is converted to a plain number (or left null) at this boundary.
const numberOrNull = (d: Prisma.Decimal | null) =>
  d === null ? null : Number(d);

// Every member of AccountTermsInput is `nullish()` and therefore optional, so
// a terms object that forgets a column compiles clean — and the card then
// shows that column's default forever, for every account, silently. Mapping
// over `keyof Required<…>` requires every key to be present while still
// allowing `undefined` as a value, so the compiler names the missing one. The
// same pin guards the two engine mappers (Complete in
// src/lib/plan/toPlanInput.ts).
type FullAccountTerms = {
  [K in keyof Required<AccountTermsInput>]: AccountTermsInput[K];
};

// One account's stored parameters, in the plain shape a client component can
// receive. An account with no AccountTerms row has answered nothing, which is
// an empty object, not a row of nulls — see accountTermsSchema.
const serializeTerms = (terms: AccountTerms): FullAccountTerms => ({
  expectedReturnPct: numberOrNull(terms.expectedReturnPct),
  feePct: numberOrNull(terms.feePct),
  minAccessAge: terms.minAccessAge,
  annualIncome: numberOrNull(terms.annualIncome),
  interestPct: numberOrNull(terms.interestPct),
  interestOnly: terms.interestOnly,
  revisionDate: terms.revisionDate,
  revisionRate: numberOrNull(terms.revisionRate),
  endDate: terms.endDate,
});

// /balance shares the FinancialPeriod row with /budget for a given month
// (?ym=YYYY-MM). The period is "virtual" (id="") until either page creates
// its first item — at which point both pages see the real row.
export default async function BalancePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
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

  // Accounts first, the month second: the sheet lists what the user owns and
  // owes, and this month's numbers are an observation left-joined onto that
  // list. An account with nothing recorded yet still gets a row — an empty
  // cell to type into — rather than being invisible until it has a value.
  const accounts = await prisma.account.findMany({
    where: {
      userId: user.id,
      OR: [
        { deletedAt: null },
        // Archived accounts stay on the past months where they recorded a value.
        ...(period
          ? [
              {
                deletedAt: { not: null },
                balanceItems: {
                  some: { periodId: period.id, deletedAt: null },
                },
              },
            ]
          : []),
      ],
    },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      section: true,
      sortOrder: true,
      terms: true,
    },
  });

  const values = period
    ? await prisma.balanceItem.findMany({
        where: {
          periodId: period.id,
          deletedAt: null,
          accountId: { in: accounts.map((a) => a.id) },
        },
        // Newest first: the left-join below keeps the first hit per account.
        orderBy: { createdAt: "desc" },
        select: {
          accountId: true,
          value: true,
          notes: true,
          carriedOver: true,
        },
      })
    : [];

  const valueByAccountId = new Map<string, (typeof values)[number]>();
  for (const value of values) {
    if (valueByAccountId.has(value.accountId)) continue;
    valueByAccountId.set(value.accountId, value);
  }

  const serializedPeriod: SerializedPeriod = {
    id: period?.id ?? "",
    label: range.label,
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };

  const serializedRows: SerializedAccountRow[] = accounts.map((account) => {
    const observed = valueByAccountId.get(account.id);
    return {
      accountId: account.id,
      name: account.name,
      type: account.type,
      kind: kindOf(account.type),
      section: account.section,
      sortOrder: account.sortOrder,
      terms: account.terms ? serializeTerms(account.terms) : {},
      value: observed ? Number(observed.value) : null,
      notes: observed?.notes ?? null,
      carriedOver: observed?.carriedOver ?? false,
    };
  });

  const recentPeriods = await prisma.financialPeriod.findMany({
    where: { userId: user.id, granularity: "MONTH" },
    orderBy: { startDate: "desc" },
    take: 12,
    select: {
      startDate: true,
      label: true,
      balanceItems: {
        where: { deletedAt: null },
        select: {
          value: true,
          account: { select: { type: true, section: true } },
        },
      },
    },
  });

  const monthSummaries: BalanceMonthSummary[] = recentPeriods
    .filter((p) => p.balanceItems.length > 0)
    .map((p) => {
      const sums = accountBalanceSums(
        p.balanceItems.map((i) => ({
          value: Number(i.value),
          account: i.account,
        })),
      );
      const assets =
        sums.assetCurrent +
        sums.assetMediumTerm +
        sums.assetLongTerm +
        sums.assetProperty +
        sums.assetOther;
      const liabilities =
        sums.liabilityCurrent +
        sums.liabilityMediumTerm +
        sums.liabilityLongTerm +
        sums.liabilityOther;
      return {
        label: p.label,
        ym: formatYm(p.startDate.getUTCFullYear(), p.startDate.getUTCMonth()),
        assets,
        liabilities,
        netWorth: assets - liabilities,
        isCurrent: p.startDate.getTime() === range.startDate.getTime(),
      };
    });

  return (
    <BalanceSheet
      key={formatYm(year, month)}
      period={serializedPeriod}
      initialRows={serializedRows}
      year={year}
      month={month}
      currency={currency}
      numberFormat={numberFormat}
      monthSummaries={monthSummaries}
    />
  );
}

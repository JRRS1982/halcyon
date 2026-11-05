"use client";

import nextDynamic from "next/dynamic";
import Link from "next/link";
import styled, { css } from "styled-components";
import { MonthBriefPanel } from "@/components/insights/MonthBriefPanel";
import { ChartFallback } from "@/components/ui/ChartFallback";
import { PageHeader } from "@/components/ui/PageHeader";
import { WhenVisible } from "@/components/ui/WhenVisible";
import type { Checklist } from "@/lib/dashboard/checklist";
import {
  type CashFlowPoint,
  type ExpenditurePoint,
  trailingAverageSeries,
} from "@/lib/dashboard/series";
import { dashboardSummary } from "@/lib/dashboard/summary";
import { overallBrief } from "@/lib/insights/overallBrief";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";
import type { BalancePoint } from "./BalanceTrendChart";
import { MonthChecklist } from "./MonthChecklist";
import { SummaryRow } from "./SummaryRow";

// Recharts is ~123KB gzipped — by far the heaviest thing the app ships, and
// none of it is needed to render the page frame. Loading each chart on demand
// keeps it out of the initial payload, and means charts the user has hidden in
// Settings are never fetched at all.
//
// `ssr: false` because these are behind auth and purely visual: server-
// rendering them would put the whole library back on the critical path for no
// SEO or first-paint gain.
const CashFlowChart = nextDynamic(
  () => import("./CashFlowChart").then((m) => m.CashFlowChart),
  { ssr: false, loading: () => <ChartFallback height={320} /> },
);

const CategoryExpenditureChart = nextDynamic(
  () =>
    import("./CategoryExpenditureChart").then(
      (m) => m.CategoryExpenditureChart,
    ),
  { ssr: false, loading: () => <ChartFallback height={180} /> },
);

const BalanceTrendChart = nextDynamic(
  () => import("./BalanceTrendChart").then((m) => m.BalanceTrendChart),
  { ssr: false, loading: () => <ChartFallback height={320} /> },
);

const BalanceCategoryChart = nextDynamic(
  () => import("./BalanceCategoryChart").then((m) => m.BalanceCategoryChart),
  { ssr: false, loading: () => <ChartFallback height={180} /> },
);

// Same greens and reds as the amount cells — these are the sign colours,
// not a separate chart palette, so they come from the token rather than
// being restated and drifting when it changes.
const ASSET_COLOR = theme.colors.positive;
const LIABILITY_COLOR = theme.colors.negative;

// Per-category balance panels: Current / Medium-term / Long-term for each side.
// `sign` flips liabilities (stored negated in BalancePoint) back to a positive
// magnitude so each debt graph reads as "how much".
const BALANCE_PANELS: {
  label: string;
  color: string;
  key: keyof BalancePoint;
  sign: 1 | -1;
}[] = [
  { label: "Current assets", color: ASSET_COLOR, key: "assetCurrent", sign: 1 },
  {
    label: "Medium-term assets",
    color: ASSET_COLOR,
    key: "assetMediumTerm",
    sign: 1,
  },
  {
    label: "Long-term assets",
    color: ASSET_COLOR,
    key: "assetLongTerm",
    sign: 1,
  },
  {
    label: "Current liabilities",
    color: LIABILITY_COLOR,
    key: "liabilityCurrent",
    sign: -1,
  },
  {
    label: "Medium-term liabilities",
    color: LIABILITY_COLOR,
    key: "liabilityMediumTerm",
    sign: -1,
  },
  {
    label: "Long-term liabilities",
    color: LIABILITY_COLOR,
    key: "liabilityLongTerm",
    sign: -1,
  },
];

// The per-category spending panels. Each shows actual vs budget vs the trailing
// 6-month average, in the category's colour.
const CATEGORY_PANELS: {
  label: string;
  color: string;
  lead: string;
  actualKey: keyof ExpenditurePoint;
  budgetKey: keyof ExpenditurePoint;
  avgKey: keyof ExpenditurePoint;
}[] = [
  {
    label: "Fixed",
    color: theme.colors.sectionFixed,
    lead: "Fixed costs each month — actual vs budget vs the 6-month average.",
    actualKey: "fixedActual",
    budgetKey: "fixedBudget",
    avgKey: "fixedAvg",
  },
  {
    label: "Variable",
    color: theme.colors.sectionVariable,
    lead: "Variable spending each month — actual vs budget vs the 6-month average.",
    actualKey: "variableActual",
    budgetKey: "variableBudget",
    avgKey: "variableAvg",
  },
  {
    label: "Discretionary",
    color: theme.colors.sectionDiscretionary,
    lead: "Discretionary spending each month — actual vs budget vs the 6-month average.",
    actualKey: "discretionaryActual",
    budgetKey: "discretionaryBudget",
    avgKey: "discretionaryAvg",
  },
];

const Shell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Panels = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
`;

// The dedicated per-category panels sit side by side on wide screens and wrap
// down to one column when there isn't room.
const CategoryGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
`;

// Each chart is a ruled section of the page, as a paper sets a chart under a
// headline, rather than a box floating on it. `$rowStart` begins a new row, so
// debts line up under the assets of the same term instead of trailing on.
const Panel = styled.section<{ $rowStart?: boolean }>`
  grid-column-start: ${({ $rowStart }) => ($rowStart ? 1 : "auto")};
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  padding-top: ${({ theme }) => theme.spacing.lg};
`;

const PanelTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  line-height: ${({ theme }) => theme.typography.displayLg.lineHeight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
`;

const PanelLead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  max-width: 70ch;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.body};
`;

// Unified card for the "this month" section: checklist status + KPI tiles
// together so the period context (the card header) covers both.
const CurrentMonthCard = styled.section`
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing["3xl"]};
`;

// Shown only when the whole dashboard has nothing in it — see `nothingToChart`.
const FirstRun = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
`;

const FirstRunTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

const FirstRunBody = styled.p`
  margin: 0;
  max-width: 68ch;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;

const FirstRunActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const FirstRunPrimary = styled(Link)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    font-family: ${theme.typography.control.family};
    font-size: ${theme.typography.control.size};
    font-weight: ${theme.typography.control.weight};
    text-decoration: none;

    &:hover {
      opacity: 0.85;
    }

    @media (max-width: 767px) {
      min-height: 44px;
    }
  `}
`;

const FirstRunSecondary = styled(FirstRunPrimary)`
  ${({ theme }) => css`
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    border: 1px solid ${theme.colors.hairline};

    &:hover {
      opacity: 1;
      border-color: ${theme.colors.ink};
    }
  `}
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 280px;
  color: ${({ theme }) => theme.colors.dim};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  text-align: center;
`;

export function DashboardView({
  balanceData,
  expenditureData,
  cashFlowData,
  currency,
  numberFormat,
  hiddenCharts = [],
  checklist,
  checklistMonth,
}: {
  balanceData: BalancePoint[];
  expenditureData: ExpenditurePoint[];
  cashFlowData: CashFlowPoint[];
  currency: string;
  numberFormat: NumberFormat;
  hiddenCharts?: string[];
  checklist: Checklist;
  checklistMonth: string;
}) {
  const shown = (key: string) => !hiddenCharts.includes(key);
  // Per-category balance series with trailing average, dropping categories that
  // are empty across every month (e.g. no medium-term debt).
  const balancePanels = BALANCE_PANELS.map((p) => ({
    ...p,
    series: trailingAverageSeries(
      balanceData.map((d) => ({
        month: d.month,
        value: (d[p.key] as number) * p.sign,
      })),
    ),
  })).filter((p) => p.series.some((s) => s.value !== 0));

  // The Fixed / Variable / Discretionary spending panels, shown under Income vs
  // expenses. Build each panel's series, then drop categories that are empty
  // across every month (no actual AND no budget) — mirroring the balance grid,
  // so an unused section (e.g. Discretionary) doesn't show a flat zero line.
  const expenditurePanels = CATEGORY_PANELS.map((c) => ({
    label: c.label,
    color: c.color,
    lead: c.lead,
    data: expenditureData.map((p) => ({
      month: p.month,
      actual: p[c.actualKey] as number,
      budget: p[c.budgetKey] as number,
      avg: p[c.avgKey] as number,
    })),
  })).filter((c) => c.data.some((d) => d.actual !== 0 || d.budget !== 0));

  const expenditureGrid =
    expenditurePanels.length > 0 ? (
      <CategoryGrid>
        {expenditurePanels.map((c) => (
          <Panel key={c.label}>
            <PanelTitle>{c.label}</PanelTitle>
            <PanelLead>{c.lead}</PanelLead>
            <WhenVisible fallback={<ChartFallback height={180} />}>
              <CategoryExpenditureChart
                color={c.color}
                currency={currency}
                numberFormat={numberFormat}
                data={c.data}
              />
            </WhenVisible>
          </Panel>
        ))}
      </CategoryGrid>
    ) : (
      <Panel>
        <PanelTitle>Spending by category</PanelTitle>
        <EmptyState>
          Record expenses on the Budget page to see Fixed, Variable and
          Discretionary spending here.
        </EmptyState>
      </Panel>
    );

  // Every panel empty means this is almost certainly someone's first visit.
  // Three separate "go to the Budget page" empty states leave a new user with
  // instructions and no idea which to follow first, so lead with one
  // explanation of why the page is blank and where to start.
  const nothingToChart =
    cashFlowData.length === 0 &&
    balanceData.length === 0 &&
    expenditurePanels.length === 0;

  // The page's headline is the whole window, not a month: the budget page
  // tells each month's story.
  const brief = overallBrief({
    balance: balanceData,
    cashFlow: cashFlowData,
    expenditure: expenditureData,
    fmt: (n) => formatAmount(currency, n, numberFormat),
  });
  const span =
    cashFlowData.length > 0
      ? {
          first: cashFlowData[0]?.month ?? "",
          last: cashFlowData.at(-1)?.month ?? "",
        }
      : null;

  const summary = dashboardSummary({
    balance: balanceData,
    cashFlow: cashFlowData,
    expenditure: expenditureData,
  });

  return (
    <Shell>
      <PageHeader
        eyebrow={
          span ? `Dashboard · ${span.first} to ${span.last}` : "Dashboard"
        }
        title={brief ? brief.headline : "Dashboard"}
        lead={brief?.standfirst || "Trends across your tracked months."}
      />
      {brief && (
        <MonthBriefPanel
          fmt={(n) => formatAmount(currency, n, numberFormat)}
          notes={brief.notes}
        />
      )}
      {/* Suppressed on a first run: four dashes over an empty-state card would
          be noise, and the card already says what to do. */}
      {!nothingToChart && (
        <CurrentMonthCard aria-label={`This month · ${checklistMonth}`}>
          <SummaryRow
            stats={summary}
            currency={currency}
            numberFormat={numberFormat}
          />
          <MonthChecklist checklist={checklist} monthLabel={checklistMonth} />
        </CurrentMonthCard>
      )}
      {nothingToChart && (
        <FirstRun>
          <FirstRunTitle>Nothing to chart yet</FirstRunTitle>
          <FirstRunBody>
            This page is built from figures you enter elsewhere — it has no
            input of its own. The quickest way to fill it is to import a bank
            statement and categorise the rows; your budget, spending breakdown
            and cash-flow chart all follow from that.
          </FirstRunBody>
          <FirstRunActions>
            <FirstRunPrimary href="/transactions">
              Import a statement
            </FirstRunPrimary>
            <FirstRunSecondary href="/guide">Read the guide</FirstRunSecondary>
          </FirstRunActions>
        </FirstRun>
      )}
      <Panels>
        {shown("cashFlow") && (
          <Panel>
            <PanelTitle>Income vs expenses</PanelTitle>
            <PanelLead>
              Money in versus money out each month — income is your net
              (take-home) figure, after tax and pension. The gap is your surplus
              or shortfall, and the dashed line tracks the share of income you
              kept.
            </PanelLead>
            {cashFlowData.length > 0 ? (
              <CashFlowChart
                data={cashFlowData}
                currency={currency}
                numberFormat={numberFormat}
              />
            ) : (
              <EmptyState>
                Record income and expenses on the Budget page to see your
                monthly cash flow and savings rate here.
              </EmptyState>
            )}
          </Panel>
        )}
        {shown("categorySpending") && expenditureGrid}
        {shown("balanceTrend") && (
          <Panel>
            <PanelTitle>Balance over time</PanelTitle>
            <PanelLead>
              Assets (green) sit above zero and debts (red) below; hover a point
              to see each category. The solid line is your net balance — total
              assets minus what you owe.
            </PanelLead>
            {balanceData.length > 0 ? (
              <BalanceTrendChart
                data={balanceData}
                currency={currency}
                numberFormat={numberFormat}
              />
            ) : (
              <EmptyState>
                Add assets and liabilities on the Balance page to see your
                balance trend here.
              </EmptyState>
            )}
          </Panel>
        )}
        {shown("balanceCategory") && balancePanels.length > 0 && (
          <CategoryGrid>
            {balancePanels.map((p, i) => (
              <Panel
                key={p.label}
                $rowStart={p.sign === -1 && balancePanels[i - 1]?.sign === 1}
              >
                <PanelTitle>{p.label}</PanelTitle>
                <PanelLead>
                  {p.label} each month, against the 6-month average.
                </PanelLead>
                <WhenVisible fallback={<ChartFallback height={180} />}>
                  <BalanceCategoryChart
                    data={p.series}
                    color={p.color}
                    currency={currency}
                    numberFormat={numberFormat}
                  />
                </WhenVisible>
              </Panel>
            ))}
          </CategoryGrid>
        )}
      </Panels>
    </Shell>
  );
}

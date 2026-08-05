"use client";

import { ChartFallback } from "@/components/ui/ChartFallback";
import { PageHeader } from "@/components/ui/PageHeader";
import { WhenVisible } from "@/components/ui/WhenVisible";
import {
  type CashFlowPoint,
  type ExpenditurePoint,
  trailingAverageSeries,
} from "@/lib/dashboard/series";
import type { NumberFormat } from "@/lib/settings/currency";
import nextDynamic from "next/dynamic";
import styled from "styled-components";
import type { BalancePoint } from "./BalanceTrendChart";

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

const ASSET_COLOR = "#1F8A4C";
const LIABILITY_COLOR = "#B33B3B";

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
    color: "#1F8A4C",
    lead: "Fixed costs each month — actual vs budget vs the 6-month average.",
    actualKey: "fixedActual",
    budgetKey: "fixedBudget",
    avgKey: "fixedAvg",
  },
  {
    label: "Variable",
    color: "#1E5BC6",
    lead: "Variable spending each month — actual vs budget vs the 6-month average.",
    actualKey: "variableActual",
    budgetKey: "variableBudget",
    avgKey: "variableAvg",
  },
  {
    label: "Discretionary",
    color: "#D97706",
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

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  padding: ${({ theme }) => theme.spacing.xl};
`;

const PanelTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

// One-line explainer under a panel title: what the chart shows and why it helps.
const PanelLead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.dim};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.4;
  max-width: 70ch;
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
}: {
  balanceData: BalancePoint[];
  expenditureData: ExpenditurePoint[];
  cashFlowData: CashFlowPoint[];
  currency: string;
  numberFormat: NumberFormat;
  hiddenCharts?: string[];
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
  // so an unused bucket (e.g. Discretionary) doesn't show a flat zero line.
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

  return (
    <Shell>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        lead="Trends across your tracked months."
      />
      <Panels>
        {shown("cashFlow") && (
          <Panel>
            <PanelTitle>Income vs expenses</PanelTitle>
            <PanelLead>
              Money in versus money out each month — income is your net
              (take-home) figure, after tax and pension. The gap is your surplus
              or shortfall, and the dashed line tracks the share of income you
              kept. Each net point is marked with its change from the month
              before (green ▲ up, red ▼ down).
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
              Assets (green) sit above zero and debts (red) below; the dash
              pattern tells the categories apart, and the solid black line is
              your net balance — total assets minus what you owe. Each net point
              is marked with its change from the month before (green ▲ up, red ▼
              down).
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
            {balancePanels.map((p) => (
              <Panel key={p.label}>
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

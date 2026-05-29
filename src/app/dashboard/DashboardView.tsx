"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  type CashFlowPoint,
  type ExpenditurePoint,
  trailingAverageSeries,
} from "@/lib/dashboard/series";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { BalanceCategoryChart } from "./BalanceCategoryChart";
import { type BalancePoint, BalanceTrendChart } from "./BalanceTrendChart";
import { CashFlowChart } from "./CashFlowChart";
import { CategoryExpenditureChart } from "./CategoryExpenditureChart";

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
}: {
  balanceData: BalancePoint[];
  expenditureData: ExpenditurePoint[];
  cashFlowData: CashFlowPoint[];
  currency: string;
  numberFormat: NumberFormat;
}) {
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
  // expenses.
  const expenditureGrid =
    expenditureData.length > 0 ? (
      <CategoryGrid>
        {CATEGORY_PANELS.map((c) => (
          <Panel key={c.label}>
            <PanelTitle>{c.label}</PanelTitle>
            <PanelLead>{c.lead}</PanelLead>
            <CategoryExpenditureChart
              color={c.color}
              currency={currency}
              numberFormat={numberFormat}
              data={expenditureData.map((p) => ({
                month: p.month,
                actual: p[c.actualKey] as number,
                budget: p[c.budgetKey] as number,
                avg: p[c.avgKey] as number,
              }))}
            />
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
        <Panel>
          <PanelTitle>Income vs expenses</PanelTitle>
          <PanelLead>
            Money in versus money out each month — income is your net
            (take-home) figure, after tax and pension. The gap is your surplus
            or shortfall, and the dashed line tracks the share of income you
            kept. Each net point is marked with its change from the month before
            (green ▲ up, red ▼ down).
          </PanelLead>
          {cashFlowData.length > 0 ? (
            <CashFlowChart
              data={cashFlowData}
              currency={currency}
              numberFormat={numberFormat}
            />
          ) : (
            <EmptyState>
              Record income and expenses on the Budget page to see your monthly
              cash flow and savings rate here.
            </EmptyState>
          )}
        </Panel>
        {expenditureGrid}
        <Panel>
          <PanelTitle>Balance over time</PanelTitle>
          <PanelLead>
            Assets (green) sit above zero and debts (red) below; the dash
            pattern tells the categories apart, and the solid black line is your
            net balance — total assets minus what you owe. Each net point is
            marked with its change from the month before (green ▲ up, red ▼
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
              Add assets and liabilities on the Balance page to see your balance
              trend here.
            </EmptyState>
          )}
        </Panel>
        {balancePanels.length > 0 && (
          <CategoryGrid>
            {balancePanels.map((p) => (
              <Panel key={p.label}>
                <PanelTitle>{p.label}</PanelTitle>
                <PanelLead>
                  {p.label} each month, against the 6-month average.
                </PanelLead>
                <BalanceCategoryChart
                  data={p.series}
                  color={p.color}
                  currency={currency}
                  numberFormat={numberFormat}
                />
              </Panel>
            ))}
          </CategoryGrid>
        )}
      </Panels>
    </Shell>
  );
}

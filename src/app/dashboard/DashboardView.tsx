"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import type {
  BudgetActualPoint,
  CashFlowPoint,
  CompositionSlice,
} from "@/lib/dashboard/series";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { type BalancePoint, BalanceTrendChart } from "./BalanceTrendChart";
import {
  BudgetVsActualChart,
  type CategoryBudgetActual,
} from "./BudgetVsActualChart";
import { CashFlowChart } from "./CashFlowChart";
import { CategoryExpenditureChart } from "./CategoryExpenditureChart";
import { CompositionChart } from "./CompositionChart";
import { ExpenditureChart, type ExpenditurePoint } from "./ExpenditureChart";

// The three dedicated per-category panels, with the same colour each uses in
// the combined chart.
const CATEGORY_PANELS: {
  label: string;
  color: string;
  actualKey: keyof ExpenditurePoint;
  avgKey: keyof ExpenditurePoint;
}[] = [
  {
    label: "Fixed",
    color: "#1F8A4C",
    actualKey: "fixedActual",
    avgKey: "fixedAvg",
  },
  {
    label: "Variable",
    color: "#1E5BC6",
    actualKey: "variableActual",
    avgKey: "variableAvg",
  },
  {
    label: "Discretionary",
    color: "#D97706",
    actualKey: "discretionaryActual",
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
  budgetCategories,
  budgetTrend,
  compositionData,
  currency,
  numberFormat,
}: {
  balanceData: BalancePoint[];
  expenditureData: ExpenditurePoint[];
  cashFlowData: CashFlowPoint[];
  budgetCategories: CategoryBudgetActual[];
  budgetTrend: BudgetActualPoint[];
  compositionData: CompositionSlice[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  return (
    <Shell>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        lead="Trends across your tracked months."
      />
      <Panels>
        <Panel>
          <PanelTitle>Balance over time</PanelTitle>
          <PanelLead>
            Assets (green) sit above zero and debts (red) below; the black line
            is your net balance — total assets minus what you owe.
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
        <Panel>
          <PanelTitle>Income vs expenses</PanelTitle>
          <PanelLead>
            Money coming in versus going out each month. The gap is your surplus
            or shortfall; the dashed line tracks the share of income you kept.
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
        <Panel>
          <PanelTitle>Expenditure vs 6-month average</PanelTitle>
          <PanelLead>
            Each spending category against its own trailing 6-month average — an
            easy way to spot a month that ran unusually hot or cold.
          </PanelLead>
          {expenditureData.length > 0 ? (
            <ExpenditureChart
              data={expenditureData}
              currency={currency}
              numberFormat={numberFormat}
            />
          ) : (
            <EmptyState>
              Record expenses on the Budget page to see your average spend by
              category here.
            </EmptyState>
          )}
        </Panel>
        {expenditureData.length > 0 && (
          <CategoryGrid>
            {CATEGORY_PANELS.map((c) => (
              <Panel key={c.label}>
                <PanelTitle>{c.label}</PanelTitle>
                <CategoryExpenditureChart
                  color={c.color}
                  currency={currency}
                  numberFormat={numberFormat}
                  data={expenditureData.map((p) => ({
                    month: p.month,
                    actual: p[c.actualKey] as number,
                    avg: p[c.avgKey] as number,
                  }))}
                />
              </Panel>
            ))}
          </CategoryGrid>
        )}
        <Panel>
          <PanelTitle>Budget vs actual</PanelTitle>
          <PanelLead>
            What you planned to spend versus what you actually spent — this
            month by category, plus the total trend. Actual above budget means
            you overspent.
          </PanelLead>
          {budgetCategories.length > 0 ? (
            <BudgetVsActualChart
              categories={budgetCategories}
              trend={budgetTrend}
              currency={currency}
              numberFormat={numberFormat}
            />
          ) : (
            <EmptyState>
              Set budgets and record actuals on the Budget page to compare them
              here.
            </EmptyState>
          )}
        </Panel>
        <Panel>
          <PanelTitle>Where the money went</PanelTitle>
          <PanelLead>
            How the latest month's spending splits across Fixed, Variable and
            Discretionary — a quick read on where most of your money goes.
          </PanelLead>
          {compositionData.length > 0 ? (
            <CompositionChart
              data={compositionData}
              currency={currency}
              numberFormat={numberFormat}
            />
          ) : (
            <EmptyState>
              Record expenses on the Budget page to see your latest spending
              breakdown here.
            </EmptyState>
          )}
        </Panel>
      </Panels>
    </Shell>
  );
}

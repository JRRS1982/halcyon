"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { type BalancePoint, BalanceTrendChart } from "./BalanceTrendChart";
import { ExpenditureChart, type ExpenditurePoint } from "./ExpenditureChart";

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
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
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
  currency,
  numberFormat,
}: {
  balanceData: BalancePoint[];
  expenditureData: ExpenditurePoint[];
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
          <PanelTitle>Average actual expenditure</PanelTitle>
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
      </Panels>
    </Shell>
  );
}

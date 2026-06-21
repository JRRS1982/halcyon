// src/app/plan/ChartPanel.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import { useState } from "react";
import styled from "styled-components";
import { CashFlowChart } from "./CashFlowChart";
import { LiquidAssetsChart } from "./LiquidAssetsChart";
import { NetWorthChart } from "./NetWorthChart";

type View = "networth" | "cashflow" | "liquid";

const VIEWS: { id: View; label: string }[] = [
  { id: "networth", label: "Net worth" },
  { id: "cashflow", label: "Cash flow" },
  { id: "liquid", label: "Liquid assets" },
];

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Switcher = styled.fieldset`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  width: fit-content;
`;
const Tab = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  font-size: 13px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.ink : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.canvas : theme.colors.body};
`;

export function ChartPanel({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const [view, setView] = useState<View>("networth");

  return (
    <Panel>
      <Switcher aria-label="Chart view">
        {VIEWS.map((v) => (
          <Tab
            key={v.id}
            type="button"
            $active={view === v.id}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Tab>
        ))}
      </Switcher>
      {view === "networth" && (
        <NetWorthChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "cashflow" && (
        <CashFlowChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "liquid" && (
        <LiquidAssetsChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
    </Panel>
  );
}

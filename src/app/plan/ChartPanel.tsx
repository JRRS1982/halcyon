// src/app/plan/ChartPanel.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import { useState } from "react";
import styled from "styled-components";
import { CashFlowChart } from "./CashFlowChart";
import { LiquidAssetsChart } from "./LiquidAssetsChart";
import { NetWorthChart } from "./NetWorthChart";
import { PlanCard } from "./PlanCard";

type View = "networth" | "cashflow" | "liquid";

const VIEWS: { id: View; label: string }[] = [
  { id: "networth", label: "Net worth" },
  { id: "cashflow", label: "Cash flow" },
  { id: "liquid", label: "Liquid assets" },
];

// One-line explainer shown under the switcher — the net-worth vs liquid-assets
// distinction (all wealth incl. property vs only the drawdownable pots) isn't
// obvious from the chart alone.
const DESCRIPTIONS: Record<View, string> = {
  networth:
    "Everything you own minus what you owe — all assets, including property, with debts subtracted. Your total financial position in today's money.",
  cashflow:
    "Money in vs money out each year: income and pot withdrawals above the line; spending, tax, loan repayments and saving below. Red marks years where the money falls short.",
  liquid:
    "Only the pots you can draw on — pensions, ISAs, GIAs and cash. Property and defined-benefit pensions are excluded. Shows whether your spendable savings last.",
};

const Switcher = styled.fieldset`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
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
const Caption = styled.p`
  margin: 0;
  max-width: 70ch;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.body};
`;

export function ChartPanel({
  low,
  mid,
  high,
  currency,
  numberFormat,
}: {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const [view, setView] = useState<View>("networth");

  return (
    <PlanCard>
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
      <Caption>{DESCRIPTIONS[view]}</Caption>
      {view === "networth" && (
        <NetWorthChart
          low={low}
          mid={mid}
          high={high}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "cashflow" && (
        <CashFlowChart
          years={mid}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "liquid" && (
        <LiquidAssetsChart
          low={low}
          mid={mid}
          high={high}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
    </PlanCard>
  );
}

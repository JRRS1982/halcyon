// src/app/plan/ChartPanel.tsx
"use client";

import { ChartFallback } from "@/components/ui/ChartFallback";
import type { YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import nextDynamic from "next/dynamic";
import { useState } from "react";
import styled from "styled-components";
import { PlanCard } from "./PlanCard";

// Only one of the three views is ever on screen, but all three used to be in
// the page's bundle. Loading each on demand means the user pays for the tab
// they actually open — and none of recharts arrives until this panel renders.
//
// The options object is written out at each call site rather than shared:
// Turbopack statically analyses `dynamic()` and needs the literal inline.
const NetWorthChart = nextDynamic(
  () => import("./NetWorthChart").then((m) => m.NetWorthChart),
  { ssr: false, loading: () => <ChartFallback height={320} /> },
);
const CashFlowChart = nextDynamic(
  () => import("./CashFlowChart").then((m) => m.CashFlowChart),
  { ssr: false, loading: () => <ChartFallback height={320} /> },
);
const LiquidAssetsChart = nextDynamic(
  () => import("./LiquidAssetsChart").then((m) => m.LiquidAssetsChart),
  { ssr: false, loading: () => <ChartFallback height={320} /> },
);

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
    "Money in vs money out each year: income and pot withdrawals above the line; spending, tax, loan repayments and saving below. While you're working, a surplus (positive cash flow) is saved into your pots. In retirement the plan draws that money back out of your accounts to cover spending, so net cash flow sits around zero for as long as your assets last. Red marks years where the money falls short.",
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
  retirementAge,
  statePensionAge,
  expectedDeathAge,
}: {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
  retirementAge: number;
  statePensionAge: number | null;
  expectedDeathAge: number | null;
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
          retirementAge={retirementAge}
          statePensionAge={statePensionAge}
          expectedDeathAge={expectedDeathAge}
        />
      )}
      {view === "cashflow" && (
        <CashFlowChart
          years={mid}
          currency={currency}
          numberFormat={numberFormat}
          retirementAge={retirementAge}
          statePensionAge={statePensionAge}
          expectedDeathAge={expectedDeathAge}
        />
      )}
      {view === "liquid" && (
        <LiquidAssetsChart
          low={low}
          mid={mid}
          high={high}
          currency={currency}
          numberFormat={numberFormat}
          retirementAge={retirementAge}
          statePensionAge={statePensionAge}
          expectedDeathAge={expectedDeathAge}
        />
      )}
    </PlanCard>
  );
}

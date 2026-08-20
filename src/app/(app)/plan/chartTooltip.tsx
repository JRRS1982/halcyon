// src/app/plan/chartTooltip.tsx
"use client";

import styled from "styled-components";
import { type StackSummary, summariseStack } from "@/lib/plan/chartData";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";

// Shared tooltip primitives for the plan charts, so the cash-flow, net-worth and
// liquid-assets readouts stay one system (dataviz: line keys not boxes, values
// lead with tabular figures, text in ink rather than the series colour).
export const TipBox = styled.div`
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: 12px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
  min-width: 200px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
`;
export const TipAge = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;
export const TipHeading = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.dim};
  margin-top: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xxs};
`;
export const TipRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  line-height: 1.6;
`;
export const TipLabel = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  flex: 1;
`;
// A short colour stroke keys the row to its mark — at tooltip density a filled
// box would be data-weight ink doing a label's job.
export const Key = styled.span<{ $c: string }>`
  width: 12px;
  height: 3px;
  border-radius: 2px;
  background: ${({ $c }) => $c};
  flex: none;
`;
export const TipName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
// The number is the strong element the reader wants; the name is secondary.
// Tabular figures keep the value column aligned.
export const TipValue = styled.span`
  flex: none;
  color: ${({ theme }) => theme.colors.ink};
  font-variant-numeric: tabular-nums;
`;
export const TipTotal = styled(TipRow)`
  font-weight: 600;
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  margin-top: ${({ theme }) => theme.spacing.xxs};
  padding-top: ${({ theme }) => theme.spacing.xxs};
`;
// The headline total (net worth / total liquid): stronger separation, ink.
const TipStrong = styled(TipRow)`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  border-top: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.xs};
  font-variant-numeric: tabular-nums;
`;

// Tooltip for the stacked-composition charts (net worth, liquid assets): each
// component pot keyed by its colour and listed largest-first, then the headline
// total emphasised at the bottom. `totalKey` names the total series' dataKey.
export function StackedTooltip({
  active,
  payload,
  label,
  currency,
  numberFormat,
  totalKey,
}: {
  active?: boolean;
  payload?: readonly {
    name?: string | number;
    value?: unknown;
    dataKey?: unknown;
    color?: string;
  }[];
  label?: string | number;
  currency: string;
  numberFormat: NumberFormat;
  totalKey: string;
}) {
  if (!active || !payload?.length) return null;
  const { components, total }: StackSummary = summariseStack(payload, totalKey);
  const fmt = (n: number) =>
    `${n < 0 ? "−" : ""}${formatAmount(currency, Math.abs(n), numberFormat)}`;

  return (
    <TipBox>
      <TipAge>Age {label}</TipAge>
      {components.map((c) => (
        <TipRow key={c.name}>
          <TipLabel>
            {c.color ? <Key $c={c.color} /> : null}
            <TipName>{c.name}</TipName>
          </TipLabel>
          <TipValue>{fmt(c.value)}</TipValue>
        </TipRow>
      ))}
      {total ? (
        <TipStrong>
          <TipName>{total.name}</TipName>
          <span>{fmt(total.value)}</span>
        </TipStrong>
      ) : null}
    </TipBox>
  );
}

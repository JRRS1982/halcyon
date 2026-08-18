"use client";

import type { SummaryStat } from "@/lib/dashboard/summary";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import styled, { css } from "styled-components";

// Four tiles across on a wide screen, folding to two and then two-by-two.
// Hairline boxes on canvas — the same chrome as the chart panels below, so the
// row reads as part of the page rather than a banner stuck on top.
const Row = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: ${({ theme }) => theme.spacing["2xl"]};

  /* The 180px floor only fits one column on a phone, and four stacked tiles
     each holding a single number push the charts a whole screen down. Two-up
     halves that. */
  @media (max-width: 767px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const Tile = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
`;

const Label = styled.div`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

// amount-xl, which DESIGN.md already assigns to the grand-total row. A bigger
// "hero" size would read well here but would mean a sixth entry on a type
// scale the design system deliberately keeps to five.
const Value = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.spacing.sm};
    font-family: ${theme.typography.amountXl.family};
    font-size: ${theme.typography.amountXl.size};
    font-weight: ${theme.typography.amountXl.weight};
    line-height: ${theme.typography.amountXl.lineHeight};
    letter-spacing: ${theme.typography.amountXl.letterSpacing};
    font-variant-numeric: tabular-nums;
    color: ${theme.colors.ink};
  `}
`;

// Direction is carried by the arrow as well as the colour, so the tile still
// reads without colour vision.
const Delta = styled.div<{ $tone: "positive" | "negative" | "neutral" }>`
  ${({ theme, $tone }) => css`
    margin-top: ${theme.spacing.xs};
    font-family: ${theme.typography.bodyMd.family};
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: ${
      $tone === "positive"
        ? theme.colors.positive
        : $tone === "negative"
          ? theme.colors.negative
          : theme.colors.body
    };
  `}
`;

const Muted = styled.span`
  color: ${({ theme }) => theme.colors.body};
`;

const formatValue = (
  stat: SummaryStat,
  currency: string,
  numberFormat: NumberFormat,
): string => {
  if (stat.value === null) return "—";
  return stat.kind === "percent"
    ? `${Math.round(stat.value)}%`
    : formatAmount(currency, stat.value, numberFormat);
};

const formatDelta = (
  stat: SummaryStat,
  currency: string,
  numberFormat: NumberFormat,
): string | null => {
  if (stat.delta === null) return null;

  const arrow = stat.delta > 0 ? "▲" : stat.delta < 0 ? "▼" : "→";
  const magnitude =
    stat.kind === "percent"
      ? `${Math.abs(Math.round(stat.delta))}%`
      : formatAmount(currency, Math.abs(stat.delta), numberFormat);

  return `${arrow} ${magnitude}`;
};

// Whether a move is good depends on the stat: net worth rising is progress,
// spending against budget rising is not.
const toneFor = (stat: SummaryStat): "positive" | "negative" | "neutral" => {
  if (stat.delta === null || stat.delta === 0) return "neutral";
  const rising = stat.delta > 0;
  const good = stat.betterWhen === "higher" ? rising : !rising;
  return good ? "positive" : "negative";
};

/**
 * The four figures the page leads with.
 *
 * A dashboard of charts answers "how has this moved" without ever answering
 * "where am I" — you had to read a trend line to find out your own net worth.
 * These say it outright, and the charts below become the explanation.
 */
export function SummaryRow({
  stats,
  currency,
  numberFormat,
}: {
  stats: SummaryStat[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  return (
    // Named so the four figures are addressable as a unit — by a screen reader
    // moving through the page, and by a test that needs "Savings rate" the
    // headline rather than "Savings rate" the cash-flow series in a chart
    // legend further down, which is the same string.
    <Row aria-label="Key figures">
      {stats.map((stat) => {
        const delta = formatDelta(stat, currency, numberFormat);
        return (
          <Tile key={stat.key}>
            <Label>{stat.label}</Label>
            <Value>{formatValue(stat, currency, numberFormat)}</Value>
            {delta ? (
              <Delta $tone={toneFor(stat)}>
                {delta} <Muted>{stat.deltaLabel}</Muted>
              </Delta>
            ) : null}
          </Tile>
        );
      })}
    </Row>
  );
}

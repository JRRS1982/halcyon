"use client";

import styled, { css } from "styled-components";
import type { SummaryStat } from "@/lib/dashboard/summary";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";

// Four figures across, set like a markets page's index strip: ruled above and
// below, divided by hairlines, no boxes. Folds to two-by-two on a phone.
const Row = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  border-top: 2px solid ${({ theme }) => theme.colors.ink};
  border-bottom: 1px solid ${({ theme }) => theme.colors.ink};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  /* The 180px floor only fits one column on a phone, and four stacked tiles
     each holding a single number push the charts a whole screen down. Two-up
     halves that. */
  @media (max-width: 767px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Tile = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  border-left: 1px solid ${({ theme }) => theme.colors.hairlineStrong};

  &:first-child {
    border-left: none;
    padding-left: 0;
  }
`;

const Label = styled.div`
  font-family: ${({ theme }) => theme.typography.kicker.family};
  font-size: ${({ theme }) => theme.typography.kicker.size};
  font-weight: ${({ theme }) => theme.typography.kicker.weight};
  letter-spacing: ${({ theme }) => theme.typography.kicker.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

// The display serif at headline size: these four are the page's index figures.
const Value = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.spacing.sm};
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
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
  // Named so the four figures are addressable as a unit — by a screen reader
  // moving through the page, and by a test that needs "Savings rate" the
  // headline rather than "Savings rate" the cash-flow series in a chart
  // legend further down, which is the same string.
  return (
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

// src/app/plan/VerdictBanner.tsx
"use client";

import type { BandedVerdict, YearProjection } from "@/lib/plan";
import { LIQUID_WRAPPERS } from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import styled from "styled-components";

// The verdict is the page's headline answer ("can I retire, does it last?"), so
// it reads as a status card: a colour rail + status eyebrow + plain-language
// headline on the left, and the two numbers that matter pulled out on the right.
const Card = styled.section<{ $ok: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-left: 3px solid
    ${({ theme, $ok }) => ($ok ? theme.colors.positive : theme.colors.negative)};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Lead = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  align-content: center;
`;

const Status = styled.span<{ $ok: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme, $ok }) =>
    $ok ? theme.colors.positive : theme.colors.negative};

  &::before {
    content: "";
    width: 9px;
    height: 9px;
    border-radius: ${({ theme }) => theme.rounded.full};
    background: currentColor;
  }
`;

const Headline = styled.h2`
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

const Sub = styled.p`
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
  margin: 0;
  max-width: 54ch;
`;

const Stats = styled.dl`
  display: flex;
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing["2xl"]};
  border-left: 1px solid ${({ theme }) => theme.colors.hairline};

  /* A phone can't fit three nowrap figures in one row — grid them two-up
     instead of pushing the whole page sideways. */
  @media (max-width: 640px) {
    padding-left: 0;
    padding-top: ${({ theme }) => theme.spacing.lg};
    border-left: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

const Stat = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  align-content: start;

  /* Hairline divider between each pulled-out figure (peak / earliest / at-age). */
  & + & {
    margin-left: ${({ theme }) => theme.spacing["2xl"]};
    padding-left: ${({ theme }) => theme.spacing["2xl"]};
    border-left: 1px solid ${({ theme }) => theme.colors.hairline};
  }

  /* The grid's gap replaces the divider spacing on a phone. */
  @media (max-width: 640px) {
    & + & {
      margin-left: 0;
      padding-left: 0;
      border-left: 0;
    }
  }
`;

const StatKey = styled.dt`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;

const StatVal = styled.dd<{ $danger?: boolean }>`
  margin: 0;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.012em;
  white-space: nowrap;

  /* In the phone's half-width grid cell the "· age 95" suffix wraps under the
     figure rather than forcing the cell wider. */
  @media (max-width: 640px) {
    white-space: normal;
  }
  color: ${({ theme, $danger }) =>
    $danger ? theme.colors.negative : theme.colors.ink};

  small {
    font-size: ${({ theme }) => theme.typography.bodyMd.size};
    font-weight: 400;
    letter-spacing: 0;
    color: ${({ theme }) => theme.colors.body};
  }
`;

const RangeNote = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;

export function VerdictBanner({
  verdict,
  years,
  expectedDeathAge,
  currency,
  numberFormat,
}: {
  verdict: BandedVerdict;
  years: YearProjection[];
  expectedDeathAge: number | null;
  currency: string;
  numberFormat: NumberFormat;
}) {
  // Value at the expected age of death (today's money, like peak net worth).
  // Only shown when that age falls within the projected range.
  const deathYear =
    expectedDeathAge === null
      ? undefined
      : years.find((y) => y.age === expectedDeathAge);
  const atDeath = deathYear
    ? {
        netWorth: deathYear.netWorth,
        liquid: deathYear.assets
          .filter((a) => LIQUID_WRAPPERS.includes(a.wrapper))
          .reduce((sum, a) => sum + a.value, 0),
      }
    : null;

  const peak = formatAmount(currency, verdict.peakNetWorth.value, numberFormat);
  const [peakLo, peakHi] = verdict.peakNetWorthRange;
  const peakRange =
    peakLo !== peakHi
      ? `${formatAmount(currency, peakLo, numberFormat)}–${formatAmount(currency, peakHi, numberFormat)}`
      : null;
  const shortRange =
    verdict.firstShortfallAgeRange &&
    verdict.firstShortfallAgeRange[0] !== verdict.firstShortfallAgeRange[1]
      ? verdict.firstShortfallAgeRange
      : null;
  const headline = verdict.feasible
    ? "Your money lasts the plan"
    : shortRange
      ? `Your money runs short at age ${verdict.firstShortfallAge} (between ${shortRange[0]} and ${shortRange[1]} depending on returns)`
      : `Your money runs short at age ${verdict.firstShortfallAge}`;
  const sub = verdict.feasible
    ? "On today's settings, the money lasts the whole plan."
    : "Try retiring later, saving more, or trimming spending below.";

  return (
    <Card $ok={verdict.feasible}>
      <Lead>
        <Status $ok={verdict.feasible}>
          {verdict.feasible ? "On track" : "Needs attention"}
        </Status>
        <Headline>{headline}</Headline>
        <Sub>{sub}</Sub>
      </Lead>
      <Stats>
        <Stat>
          <StatKey>Peak net worth</StatKey>
          <StatVal>
            {peak} <small>· age {verdict.peakNetWorth.age}</small>
          </StatVal>
          {peakRange ? <RangeNote>range {peakRange}</RangeNote> : null}
        </Stat>
        {verdict.feasible ? null : (
          <Stat>
            <StatKey>Money runs out</StatKey>
            <StatVal $danger>Age {verdict.firstShortfallAge}</StatVal>
            {shortRange ? (
              <RangeNote>
                range {shortRange[0]}–{shortRange[1]}
              </RangeNote>
            ) : null}
          </Stat>
        )}
        {atDeath ? (
          <Stat>
            <StatKey>At age {expectedDeathAge}</StatKey>
            <StatVal>
              {formatAmount(currency, atDeath.netWorth, numberFormat)}
            </StatVal>
            <RangeNote>
              liquid {formatAmount(currency, atDeath.liquid, numberFormat)}
            </RangeNote>
          </Stat>
        ) : null}
      </Stats>
    </Card>
  );
}

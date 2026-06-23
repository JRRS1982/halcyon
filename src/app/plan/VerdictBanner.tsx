// src/app/plan/VerdictBanner.tsx
"use client";

import type { Verdict } from "@/lib/plan";
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
  gap: ${({ theme }) => theme.spacing["2xl"]};
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing["2xl"]};
  border-left: 1px solid ${({ theme }) => theme.colors.hairline};

  @media (max-width: 640px) {
    padding-left: 0;
    padding-top: ${({ theme }) => theme.spacing.lg};
    border-left: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  }
`;

const Stat = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  align-content: start;
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
  color: ${({ theme, $danger }) =>
    $danger ? theme.colors.negative : theme.colors.ink};

  small {
    font-size: ${({ theme }) => theme.typography.bodyMd.size};
    font-weight: 400;
    letter-spacing: 0;
    color: ${({ theme }) => theme.colors.body};
  }
`;

export function VerdictBanner({
  verdict,
  currency,
  numberFormat,
}: {
  verdict: Verdict;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const peak = formatAmount(currency, verdict.peakNetWorth.value, numberFormat);
  const headline = verdict.feasible
    ? "Your money lasts the plan"
    : `Your money runs short at age ${verdict.firstShortfallAge}`;
  const sub = verdict.feasible
    ? verdict.earliestSustainableRetirementAge !== null
      ? `You could retire as early as age ${verdict.earliestSustainableRetirementAge} and the money still lasts.`
      : "On today's settings, the money lasts the whole plan."
    : verdict.earliestSustainableRetirementAge !== null
      ? `Retiring at age ${verdict.earliestSustainableRetirementAge} or later would make it last — or save more, or trim spending below.`
      : "No retirement age in range is sustainable yet — try retiring later, saving more, or trimming spending below.";

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
        </Stat>
        <Stat>
          {verdict.feasible ? (
            <>
              <StatKey>Earliest retirement</StatKey>
              <StatVal>
                {verdict.earliestSustainableRetirementAge !== null
                  ? `Age ${verdict.earliestSustainableRetirementAge}`
                  : "In range"}
              </StatVal>
            </>
          ) : (
            <>
              <StatKey>Money runs out</StatKey>
              <StatVal $danger>Age {verdict.firstShortfallAge}</StatVal>
            </>
          )}
        </Stat>
      </Stats>
    </Card>
  );
}

// src/app/plan/VerdictBanner.tsx
"use client";

import type { Verdict } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import styled from "styled-components";

const Banner = styled.div<{ $ok: boolean }>`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-left: 4px solid
    ${({ theme, $ok }) => ($ok ? theme.colors.positive : theme.colors.negative)};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.canvas};
`;

const Headline = styled.p`
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

const Sub = styled.p`
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
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
    ? "On track — your money lasts the plan"
    : `Runs short at age ${verdict.firstShortfallAge}`;
  const earliest =
    verdict.earliestSustainableRetirementAge !== null
      ? `Earliest sustainable retirement: age ${verdict.earliestSustainableRetirementAge}.`
      : "No retirement age in range is sustainable yet.";

  return (
    <Banner $ok={verdict.feasible}>
      <Headline>{headline}</Headline>
      <Sub>
        Peak net worth {peak} at age {verdict.peakNetWorth.age} (today's money).{" "}
        {earliest}
      </Sub>
    </Banner>
  );
}

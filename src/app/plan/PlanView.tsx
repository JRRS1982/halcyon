// src/app/plan/PlanView.tsx
"use client";

import type { Verdict, YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { AssetsTable } from "./AssetsTable";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { LiabilitiesTable } from "./LiabilitiesTable";
import { NetWorthChart } from "./NetWorthChart";
import { VerdictBanner } from "./VerdictBanner";
import type { SerializedPlan } from "./serialized";

const Shell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]} ${({ theme }) => theme.spacing["2xl"]};
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
`;
const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.displayXl.size};
  font-weight: ${({ theme }) => theme.typography.displayXl.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

export function PlanView({
  years,
  verdict,
  plan,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  verdict: Verdict;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
}) {
  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner
        verdict={verdict}
        currency={currency}
        numberFormat={numberFormat}
      />
      <NetWorthChart
        years={years}
        currency={currency}
        numberFormat={numberFormat}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <AssetsTable assets={plan.assets} />
      <LiabilitiesTable liabilities={plan.liabilities} />
    </Shell>
  );
}

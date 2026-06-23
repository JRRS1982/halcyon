// src/app/plan/PlanView.tsx
"use client";

import type { Verdict, YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { AssetsTable } from "./AssetsTable";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { ChartPanel } from "./ChartPanel";
import { EventsTable } from "./EventsTable";
import { ExpensesTable } from "./ExpensesTable";
import { IncomesTable } from "./IncomesTable";
import { LiabilitiesTable } from "./LiabilitiesTable";
import { Timeline } from "./Timeline";
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
      <ChartPanel
        years={years}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={plan.events}
        retirementAge={plan.assumptions.retirementAge}
        statePensionAge={plan.assumptions.statePensionAge}
        minAge={years[0]?.age ?? 0}
        maxAge={years[years.length - 1]?.age ?? 0}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <AssetsTable assets={plan.assets} />
      <LiabilitiesTable liabilities={plan.liabilities} />
      <IncomesTable incomes={plan.incomes} />
      <ExpensesTable expenses={plan.expenses} />
      <EventsTable events={plan.events} />
    </Shell>
  );
}

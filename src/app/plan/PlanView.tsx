// src/app/plan/PlanView.tsx
"use client";

import type { BandedProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { AssetFields, AssetsTable } from "./AssetsTable";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { ChartPanel } from "./ChartPanel";
import { EventFields, EventsTable } from "./EventsTable";
import { ExpenseFields, ExpensesTable } from "./ExpensesTable";
import { IncomeFields, IncomesTable } from "./IncomesTable";
import { LiabilitiesTable, LiabilityFields } from "./LiabilitiesTable";
import { PlanDrawer } from "./PlanDrawer";
import { Sliders } from "./Sliders";
import { Timeline } from "./Timeline";
import { VerdictBanner } from "./VerdictBanner";
import {
  deletePlanAsset,
  deletePlanEvent,
  deletePlanExpense,
  deletePlanIncome,
  deletePlanLiability,
} from "./actions";
import type { SerializedPlan } from "./serialized";
import { usePlanProjection } from "./usePlanProjection";

type Kind = "asset" | "liability" | "income" | "expense" | "event";

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
  band,
  plan,
  currency,
  numberFormat,
  asOfYear,
}: {
  band: BandedProjection;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
  asOfYear: number;
}) {
  const router = useRouter();
  const { liveBand, effectiveAssumptions, setOverride, commit } =
    usePlanProjection(plan, band, asOfYear);
  const [selected, setSelected] = useState<{ kind: Kind; id: string } | null>(
    null,
  );
  const open = (kind: Kind) => (id: string) => setSelected({ kind, id });
  const close = () => setSelected(null);

  const asset =
    selected?.kind === "asset"
      ? plan.assets.find((a) => a.id === selected.id)
      : undefined;
  const liability =
    selected?.kind === "liability"
      ? plan.liabilities.find((l) => l.id === selected.id)
      : undefined;
  const income =
    selected?.kind === "income"
      ? plan.incomes.find((i) => i.id === selected.id)
      : undefined;
  const expense =
    selected?.kind === "expense"
      ? plan.expenses.find((e) => e.id === selected.id)
      : undefined;
  const event =
    selected?.kind === "event"
      ? plan.events.find((ev) => ev.id === selected.id)
      : undefined;
  const target = asset ?? liability ?? income ?? expense ?? event;

  const title = target ? ("label" in target ? target.label : "") : "";
  const eyebrow =
    asset !== undefined
      ? "Asset"
      : liability !== undefined
        ? "Liability"
        : income !== undefined
          ? "Income"
          : expense !== undefined
            ? "Expense"
            : event !== undefined
              ? "Event"
              : undefined;

  const onRemove = async () => {
    if (!selected) return;
    const remove =
      selected.kind === "asset"
        ? deletePlanAsset
        : selected.kind === "liability"
          ? deletePlanLiability
          : selected.kind === "income"
            ? deletePlanIncome
            : selected.kind === "expense"
              ? deletePlanExpense
              : deletePlanEvent;
    await remove({ id: selected.id });
    close();
    router.refresh();
  };

  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner
        verdict={liveBand.verdict}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Sliders
        assumptions={effectiveAssumptions}
        onInput={setOverride}
        onCommit={commit}
      />
      <ChartPanel
        low={liveBand.low}
        mid={liveBand.mid}
        high={liveBand.high}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={plan.events}
        retirementAge={effectiveAssumptions.retirementAge}
        statePensionAge={effectiveAssumptions.statePensionAge}
        minAge={liveBand.mid[0]?.age ?? 0}
        maxAge={liveBand.mid[liveBand.mid.length - 1]?.age ?? 0}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <AssetsTable
        assets={plan.assets}
        currency={currency}
        numberFormat={numberFormat}
        onOpen={open("asset")}
      />
      <LiabilitiesTable
        liabilities={plan.liabilities}
        currency={currency}
        numberFormat={numberFormat}
        onOpen={open("liability")}
      />
      <IncomesTable
        incomes={plan.incomes}
        currency={currency}
        numberFormat={numberFormat}
        onOpen={open("income")}
      />
      <ExpensesTable
        expenses={plan.expenses}
        currency={currency}
        numberFormat={numberFormat}
        onOpen={open("expense")}
      />
      <EventsTable
        events={plan.events}
        currency={currency}
        numberFormat={numberFormat}
        onOpen={open("event")}
      />

      <PlanDrawer
        open={target !== undefined}
        eyebrow={eyebrow}
        title={title}
        onClose={close}
        onRemove={onRemove}
      >
        {asset ? <AssetFields asset={asset} /> : null}
        {liability ? <LiabilityFields liability={liability} /> : null}
        {income ? <IncomeFields income={income} /> : null}
        {expense ? <ExpenseFields expense={expense} /> : null}
        {event ? <EventFields event={event} /> : null}
      </PlanDrawer>
    </Shell>
  );
}

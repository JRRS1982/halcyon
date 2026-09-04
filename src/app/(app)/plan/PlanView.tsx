// src/app/plan/PlanView.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { Drawer } from "@/components/ui/Drawer";
import type { BandedProjection } from "@/lib/plan";
import type { SyncPlan } from "@/lib/plan/sync";
import type { NumberFormat } from "@/lib/settings/currency";
import { AssetFields, AssetsTable } from "./AssetsTable";
import { AssumptionsPanel } from "./AssumptionsPanel";
import {
  deletePlanAsset,
  deletePlanEvent,
  deletePlanExpense,
  deletePlanIncome,
  deletePlanLiability,
} from "./actions";
import { ChartPanel } from "./ChartPanel";
import { EventFields, EventsTable } from "./EventsTable";
import { ExpenseFields, ExpensesTable } from "./ExpensesTable";
import { IncomeFields, IncomesTable } from "./IncomesTable";
import { LiabilitiesTable, LiabilityFields } from "./LiabilitiesTable";
import { PropertyFields } from "./PropertyFields";
import { SyncButton } from "./SyncButton";
import type { SerializedPlan } from "./serialized";
import { TaxBandsCard } from "./TaxBandsCard";
import { Timeline } from "./Timeline";
import { usePlanProjection } from "./usePlanProjection";
import { VerdictBanner } from "./VerdictBanner";

// No plan changes without a Sync, so an "up to date" preview is a safe
// default for the moment before the server-loaded preview arrives.
const EMPTY_SYNC_PLAN: SyncPlan = {
  updates: [],
  additions: [],
  removals: [],
  unchanged: [],
};

type Kind = "asset" | "liability" | "income" | "expense" | "event";

const Shell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]} ${({ theme }) => theme.spacing["2xl"]};
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;
const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.displayXl.size};
  font-weight: ${({ theme }) => theme.typography.displayXl.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
// All record cards in one responsive grid: as many equal ~320px+ columns as fit
// (2–3 on desktop, 1 on mobile — no manual breakpoints). align-items: start so
// each card is only as tall as its own content rather than stretching to match
// its row neighbour.
const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing["2xl"]};
  align-items: start;
`;

export function PlanView({
  band,
  plan,
  currency,
  numberFormat,
  asOfYear,
  syncPreview,
}: {
  band: BandedProjection;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
  asOfYear: number;
  syncPreview: SyncPlan | null;
}) {
  const router = useRouter();
  const preview = syncPreview ?? EMPTY_SYNC_PLAN;
  const {
    liveBand,
    effectiveAssumptions,
    liveEvents,
    liveIncomes,
    liveExpenses,
    liveLiabilities,
    setEventOverride,
    commitEvent,
    setStreamOverride,
    commitStream,
  } = usePlanProjection(plan, band, asOfYear);
  const [selected, setSelected] = useState<{ kind: Kind; id: string } | null>(
    null,
  );
  const open = (kind: Kind) => (id: string) => setSelected({ kind, id });
  const close = () => setSelected(null);

  const properties = plan.assets
    .filter((a) => a.wrapper === "PROPERTY")
    .map((a) => ({ id: a.id, label: a.label }));

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

  // A record is "part of a property" when the selected asset is itself a
  // PROPERTY, the selected liability is a mortgage (linkedAssetId), or the
  // selected expense is that mortgage's repayment. All three route to the
  // shared PropertyFields card for the underlying property.
  const propertyAsset =
    asset?.wrapper === "PROPERTY"
      ? asset
      : liability?.linkedAssetId
        ? plan.assets.find((a) => a.id === liability.linkedAssetId)
        : expense?.liabilityId
          ? (() => {
              const l = plan.liabilities.find(
                (x) => x.id === expense.liabilityId,
              );
              return l?.linkedAssetId
                ? plan.assets.find((a) => a.id === l.linkedAssetId)
                : undefined;
            })()
          : undefined;
  const propertyMortgage = propertyAsset
    ? plan.liabilities.find((l) => l.linkedAssetId === propertyAsset.id)
    : undefined;
  const propertyRepayment = propertyMortgage
    ? plan.expenses.find((e) => e.liabilityId === propertyMortgage.id)
    : undefined;
  // The mortgage's current-year interest/principal split, sourced from the
  // first projected year in which it's active (rather than year 0, which is
  // 0/0/0 before the mortgage starts).
  const mortgageSplit = propertyMortgage
    ? (() => {
        const y = liveBand.mid.find((yr) =>
          yr.liabilities.some(
            (l) =>
              l.id === propertyMortgage.id &&
              (l.interest !== 0 || l.principal !== 0 || l.value !== 0),
          ),
        );
        const lb = y?.liabilities.find((l) => l.id === propertyMortgage.id);
        return lb
          ? { interest: lb.interest, principal: lb.principal }
          : undefined;
      })()
    : undefined;

  const title = propertyAsset
    ? propertyAsset.label
    : target
      ? "label" in target
        ? target.label
        : ""
      : "";
  const eyebrow = propertyAsset
    ? "Property"
    : asset !== undefined
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

  // The property–mortgage link is one-to-one, so an add drawer may only offer
  // the halves still free. Derived here rather than fetched: the page already
  // holds every row.
  const mortgagedAssetIds = new Set(
    plan.liabilities.flatMap((l) => (l.linkedAssetId ? [l.linkedAssetId] : [])),
  );
  const unlinkedMortgages = plan.liabilities
    .filter((l) => l.linkedAssetId === null)
    .map((l) => ({ id: l.id, label: l.label }));
  const unmortgagedProperties = plan.assets
    .filter((a) => a.wrapper === "PROPERTY" && !mortgagedAssetIds.has(a.id))
    .map((a) => ({ id: a.id, label: a.label }));

  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner
        verdict={liveBand.verdict}
        currency={currency}
        numberFormat={numberFormat}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <TaxBandsCard regime={plan.assumptions.taxRegime} />
      <ChartPanel
        low={liveBand.low}
        mid={liveBand.mid}
        high={liveBand.high}
        currency={currency}
        numberFormat={numberFormat}
        retirementAge={effectiveAssumptions.retirementAge}
        statePensionAge={effectiveAssumptions.statePensionAge}
        expectedDeathAge={effectiveAssumptions.expectedDeathAge}
      />
      <Timeline
        incomes={liveIncomes}
        expenses={liveExpenses}
        liabilities={liveLiabilities}
        events={liveEvents}
        retirementAge={effectiveAssumptions.retirementAge}
        statePensionAge={effectiveAssumptions.statePensionAge}
        expectedDeathAge={effectiveAssumptions.expectedDeathAge}
        minAge={liveBand.mid[0]?.age ?? 0}
        maxAge={liveBand.mid[liveBand.mid.length - 1]?.age ?? 0}
        onEventInput={setEventOverride}
        onEventCommit={commitEvent}
        onStreamInput={setStreamOverride}
        onStreamCommit={commitStream}
      />
      <SyncButton preview={preview} onSynced={() => router.refresh()} />

      <Cards>
        <AssetsTable
          assets={plan.assets}
          currency={currency}
          numberFormat={numberFormat}
          syncPreview={preview}
          unlinkedMortgages={unlinkedMortgages}
          onOpen={open("asset")}
        />
        <LiabilitiesTable
          liabilities={plan.liabilities}
          currency={currency}
          numberFormat={numberFormat}
          syncPreview={preview}
          unmortgagedProperties={unmortgagedProperties}
          onOpen={open("liability")}
          onOpenProperty={open("asset")}
        />
        <IncomesTable
          incomes={plan.incomes}
          currency={currency}
          numberFormat={numberFormat}
          syncPreview={preview}
          onOpen={open("income")}
        />
        <ExpensesTable
          expenses={plan.expenses}
          currency={currency}
          numberFormat={numberFormat}
          syncPreview={preview}
          onOpen={open("expense")}
        />
        <EventsTable
          events={plan.events}
          currency={currency}
          numberFormat={numberFormat}
          properties={properties}
          onOpen={open("event")}
        />
      </Cards>

      <Drawer
        open={target !== undefined}
        eyebrow={eyebrow}
        title={title}
        onClose={close}
        // A property can be removed, and deletePlanAsset cascades to its
        // mortgage and that mortgage's repayment expense — so the confirm says
        // so rather than leaving the user to discover it.
        //
        // A repayment expense still cannot be removed on its own: it belongs
        // to the mortgage, and deleting it alone would leave a mortgage
        // nothing pays.
        onRemove={
          selected?.kind === "expense" && expense?.liabilityId
            ? undefined
            : onRemove
        }
        removeConfirmLabel={
          propertyAsset && propertyMortgage
            ? "Remove the property, its mortgage and the repayment?"
            : undefined
        }
      >
        {propertyAsset ? (
          <PropertyFields
            property={propertyAsset}
            mortgage={propertyMortgage}
            repayment={propertyRepayment}
            currentSplit={mortgageSplit}
          />
        ) : (
          <>
            {asset ? <AssetFields asset={asset} /> : null}
            {liability ? (
              <LiabilityFields
                liability={liability}
                linkedExpense={plan.expenses.find(
                  (e) => e.liabilityId === liability.id,
                )}
                onOpenExpense={open("expense")}
              />
            ) : null}
            {income ? <IncomeFields income={income} /> : null}
            {expense ? (
              <ExpenseFields
                expense={expense}
                managedBy={
                  expense.liabilityId
                    ? plan.liabilities.find((l) => l.id === expense.liabilityId)
                    : undefined
                }
                onOpenLiability={open("liability")}
              />
            ) : null}
            {event ? (
              <EventFields event={event} properties={properties} />
            ) : null}
          </>
        )}
      </Drawer>
    </Shell>
  );
}

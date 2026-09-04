// src/app/plan/PropertyFields.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "@/components/ui/Drawer";
import {
  createMortgageForProperty,
  deletePlanLiability,
  updatePlanAsset,
  updatePlanExpense,
  updatePlanLiability,
} from "./actions";
import { BoolCell, NumberCell, TextCell } from "./EditableCell";
import type {
  SerializedPlanAsset,
  SerializedPlanExpense,
  SerializedPlanLiability,
} from "./serialized";

const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;
const ActionButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  background: transparent;
  color: ${({ theme }) => theme.colors.ink};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-size: 13px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  width: fit-content;
`;
const ReadoutSpan = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
`;

export function PropertyFields({
  property,
  mortgage,
  repayment,
  currentSplit,
}: {
  property: SerializedPlanAsset;
  mortgage: SerializedPlanLiability | undefined;
  repayment: SerializedPlanExpense | undefined;
  currentSplit?: { interest: number; principal: number };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  // The two drawer actions below are bare writes: no form, no navigation, and
  // — unlike the Add buttons on the sheet, which AddRowButton already guards —
  // nothing stopping a second click landing while the first is still in
  // flight, which adds a second mortgage or deletes one twice. Disabling beats
  // debouncing: a debounce only delays the first click, whereas a disabled
  // button never lets the second one reach the action.
  //
  // Only these two, not `run` itself: the field commits below already have the
  // cell they were typed into to hold the interaction, and flipping this on
  // every save would grey the buttons out mid-edit for no reason.
  const [actionPending, setActionPending] = useState(false);
  const runAction = async (fn: () => Promise<unknown>) => {
    setActionPending(true);
    try {
      await run(fn);
    } finally {
      setActionPending(false);
    }
  };

  const saveProperty = (next: SerializedPlanAsset) =>
    run(() =>
      updatePlanAsset({
        assetId: next.id,
        label: next.label,
        wrapper: next.wrapper,
        openingValue: next.openingValue,
        expectedReturnPct: next.expectedReturnPct,
        feePct: next.feePct,
        monthlyContribution: next.monthlyContribution,
        contributionEndAge: next.contributionEndAge,
        minAccessAge: next.minAccessAge,
        drawdownPriority: next.drawdownPriority,
      }),
    );

  const saveMortgage = (next: SerializedPlanLiability) =>
    run(() =>
      updatePlanLiability({
        liabilityId: next.id,
        label: next.label,
        openingBalance: next.openingBalance,
        interestPct: next.interestPct,
        monthlyRepayment: next.monthlyRepayment,
        startAge: next.startAge,
        endAge: next.endAge,
        linkedAssetId: next.linkedAssetId,
        interestOnly: next.interestOnly,
      }),
    );

  const savePayment = (annualAmount: number) => {
    if (!repayment) return;
    return run(() =>
      updatePlanExpense({
        expenseId: repayment.id,
        label: repayment.label,
        // A repayment expense carries no section (see actions.ts's
        // linkRepaymentExpense) — the fallback only satisfies the schema,
        // which is shared with plain expenses that always have one.
        section: repayment.section ?? "FIXED",
        annualAmount,
        startAge: repayment.startAge,
        endAge: repayment.endAge,
        inflationLinked: repayment.inflationLinked,
      }),
    );
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}

      <DrawerSection title="Property" defaultOpen>
        <Field label="Label">
          <TextCell
            value={property.label}
            onCommit={(v) => saveProperty({ ...property, label: v })}
          />
        </Field>
        <Field label="Current value">
          <NumberCell
            value={property.openingValue}
            onCommit={(v) =>
              saveProperty({
                ...property,
                openingValue: v ?? property.openingValue,
              })
            }
          />
        </Field>
        <Field label="Growth %">
          <NumberCell
            value={property.expectedReturnPct}
            nullable
            step="0.1"
            onCommit={(v) =>
              saveProperty({ ...property, expectedReturnPct: v })
            }
          />
        </Field>
      </DrawerSection>

      {mortgage ? (
        <DrawerSection title="Mortgage" defaultOpen>
          <Field label="Balance">
            <NumberCell
              value={mortgage.openingBalance}
              onCommit={(v) =>
                saveMortgage({
                  ...mortgage,
                  openingBalance: v ?? mortgage.openingBalance,
                })
              }
            />
          </Field>
          <Field label="Interest %">
            <NumberCell
              value={mortgage.interestPct}
              step="0.1"
              onCommit={(v) =>
                saveMortgage({
                  ...mortgage,
                  interestPct: v ?? mortgage.interestPct,
                })
              }
            />
          </Field>
          <Field label="Interest-only">
            <BoolCell
              value={mortgage.interestOnly}
              onCommit={(v) => saveMortgage({ ...mortgage, interestOnly: v })}
            />
          </Field>
          {!mortgage.interestOnly && repayment ? (
            <Field label="Repayment /mo">
              <NumberCell
                value={Math.round(repayment.annualAmount / 12)}
                onCommit={(v) => savePayment((v ?? 0) * 12)}
              />
            </Field>
          ) : null}
          {currentSplit ? (
            <Field label="This year">
              <ReadoutSpan>
                {`${Math.round(currentSplit.interest)} interest · ${Math.round(currentSplit.principal)} principal`}
              </ReadoutSpan>
            </Field>
          ) : null}
          <Field label="Starts at age (blank = now)">
            <NumberCell
              value={mortgage.startAge}
              nullable
              onCommit={(v) => saveMortgage({ ...mortgage, startAge: v })}
            />
          </Field>
          <Field label="Paid off by age (blank = none)">
            <NumberCell
              value={mortgage.endAge}
              nullable
              onCommit={(v) => saveMortgage({ ...mortgage, endAge: v })}
            />
          </Field>
          <ActionButton
            type="button"
            disabled={actionPending}
            onClick={() =>
              runAction(() => deletePlanLiability({ id: mortgage.id }))
            }
          >
            Remove mortgage
          </ActionButton>
        </DrawerSection>
      ) : (
        <DrawerSection title="Mortgage" defaultOpen>
          <ActionButton
            type="button"
            disabled={actionPending}
            onClick={() =>
              runAction(() =>
                createMortgageForProperty({ assetId: property.id }),
              )
            }
          >
            Add mortgage
          </ActionButton>
        </DrawerSection>
      )}
    </>
  );
}

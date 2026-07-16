// src/app/plan/LiabilitiesTable.tsx
"use client";

import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, TextCell } from "./EditableCell";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import {
  createPlanLiability,
  linkRepaymentExpense,
  unlinkRepaymentExpense,
  updatePlanLiability,
} from "./actions";
import type {
  SerializedPlanExpense,
  SerializedPlanLiability,
} from "./serialized";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;
const LinkedRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`;
const LinkedButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.body};
  font-size: 12px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  width: fit-content;
`;

export function LiabilityFields({
  liability,
  linkedExpense,
  onOpenExpense,
}: {
  liability: SerializedPlanLiability;
  linkedExpense: SerializedPlanExpense | undefined;
  onOpenExpense: (id: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanLiability) => {
    setError(null);
    try {
      await updatePlanLiability({
        liabilityId: next.id,
        label: next.label,
        openingBalance: next.openingBalance,
        interestPct: next.interestPct,
        monthlyRepayment: next.monthlyRepayment,
        startAge: next.startAge,
        endAge: next.endAge,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const link = async () => {
    setError(null);
    try {
      const id = await linkRepaymentExpense({ liabilityId: liability.id });
      router.refresh();
      onOpenExpense(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link");
    }
  };

  const unlink = async () => {
    if (!linkedExpense) return;
    setError(null);
    try {
      await unlinkRepaymentExpense({ id: linkedExpense.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlink");
    }
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell
            value={liability.label}
            onCommit={(v) => save({ ...liability, label: v })}
          />
        </Field>
        <Field label="Balance">
          <NumberCell
            value={liability.openingBalance}
            onCommit={(v) =>
              save({
                ...liability,
                openingBalance: v ?? liability.openingBalance,
              })
            }
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Terms">
        <Field label="Interest %">
          <NumberCell
            value={liability.interestPct}
            step="0.1"
            onCommit={(v) =>
              save({ ...liability, interestPct: v ?? liability.interestPct })
            }
          />
        </Field>
        {linkedExpense ? (
          <Field label="Repayment (managed by expense)">
            <LinkedRow>
              <LinkedButton
                type="button"
                onClick={() => onOpenExpense(linkedExpense.id)}
              >
                {`${Math.round(linkedExpense.annualAmount / 12)}/mo — edit expense`}
              </LinkedButton>
              <LinkedButton type="button" onClick={unlink}>
                Unlink
              </LinkedButton>
            </LinkedRow>
          </Field>
        ) : (
          <>
            <Field label="Repayment /mo">
              <NumberCell
                value={liability.monthlyRepayment}
                onCommit={(v) =>
                  save({
                    ...liability,
                    monthlyRepayment: v ?? liability.monthlyRepayment,
                  })
                }
              />
            </Field>
            <LinkedButton type="button" onClick={link}>
              Track repayment as an expense
            </LinkedButton>
          </>
        )}
        <Field label="Starts at age (blank = now)">
          <NumberCell
            value={liability.startAge}
            nullable
            onCommit={(v) => save({ ...liability, startAge: v })}
          />
        </Field>
        <Field label="Paid off by age (blank = none)">
          <NumberCell
            value={liability.endAge}
            nullable
            onCommit={(v) => save({ ...liability, endAge: v })}
          />
        </Field>
      </DrawerSection>
    </>
  );
}

export function LiabilitiesTable({
  liabilities,
  currency,
  numberFormat,
  onOpen,
}: {
  liabilities: SerializedPlanLiability[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanLiability();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Liabilities</Heading>
      {liabilities.length === 0 ? (
        <Empty>No liabilities yet.</Empty>
      ) : (
        <SummaryList>
          {liabilities.map((l) => (
            <SummaryRow
              key={l.id}
              primary={l.label}
              secondary={`${formatAmount(currency, l.openingBalance, numberFormat)} · ${l.interestPct}%`}
              onOpen={() => onOpen(l.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add liability" onAdd={add} />
    </Panel>
  );
}

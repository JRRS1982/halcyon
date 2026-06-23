// src/app/plan/IncomesTable.tsx
"use client";

import type { IncomeKind } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanIncome, updatePlanIncome } from "./actions";
import type { GrowthKind, SerializedPlanIncome } from "./serialized";

const INCOME_KINDS: IncomeKind[] = [
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
];
const GROWTH_KINDS: GrowthKind[] = ["INFLATION", "FIXED", "NONE"];

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

export function IncomeFields({ income }: { income: SerializedPlanIncome }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanIncome) => {
    setError(null);
    try {
      await updatePlanIncome({
        incomeId: next.id,
        label: next.label,
        kind: next.kind,
        annualAmount: next.annualAmount,
        startAge: next.startAge,
        endAge: next.endAge,
        growthKind: next.growthKind,
        growthPct: next.growthPct,
        taxable: next.taxable,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell
            value={income.label}
            onCommit={(v) => save({ ...income, label: v })}
          />
        </Field>
        <Field label="Kind">
          <SelectCell
            value={income.kind}
            options={INCOME_KINDS}
            onCommit={(v) => save({ ...income, kind: v })}
          />
        </Field>
        <Field label="Amount /yr">
          <NumberCell
            value={income.annualAmount}
            onCommit={(v) =>
              save({ ...income, annualAmount: v ?? income.annualAmount })
            }
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Timing">
        <Field label="Start age (blank = from now)">
          <NumberCell
            value={income.startAge}
            nullable
            onCommit={(v) => save({ ...income, startAge: v })}
          />
        </Field>
        <Field label="End age (blank = end of plan)">
          <NumberCell
            value={income.endAge}
            nullable
            onCommit={(v) => save({ ...income, endAge: v })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Growth">
        <Field label="Grows by">
          <SelectCell
            value={income.growthKind}
            options={GROWTH_KINDS}
            onCommit={(v) => save({ ...income, growthKind: v })}
          />
        </Field>
        {income.growthKind === "FIXED" ? (
          <Field label="Fixed growth %">
            <NumberCell
              value={income.growthPct}
              nullable
              step="0.1"
              onCommit={(v) => save({ ...income, growthPct: v })}
            />
          </Field>
        ) : null}
      </DrawerSection>
      <DrawerSection title="Tax">
        <Field label="Taxable">
          <BoolCell
            value={income.taxable}
            onCommit={(v) => save({ ...income, taxable: v })}
          />
        </Field>
      </DrawerSection>
    </>
  );
}

export function IncomesTable({
  incomes,
  currency,
  numberFormat,
  onOpen,
}: {
  incomes: SerializedPlanIncome[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanIncome();
    router.refresh();
    onOpen(id);
  };
  const span = (i: SerializedPlanIncome) =>
    `age ${i.startAge ?? "now"}→${i.endAge ?? "end"}`;

  return (
    <Panel>
      <Heading>Income</Heading>
      {incomes.length === 0 ? (
        <Empty>No income yet.</Empty>
      ) : (
        <SummaryList>
          {incomes.map((i) => (
            <SummaryRow
              key={i.id}
              primary={i.label}
              secondary={`${formatAmount(currency, i.annualAmount, numberFormat)}/yr · ${span(i)}`}
              onOpen={() => onOpen(i.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add income" onAdd={add} />
    </Panel>
  );
}

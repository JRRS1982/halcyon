// src/app/plan/ExpensesTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import type { ExpenseCategory } from "@/lib/plan";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { createPlanExpense, updatePlanExpense } from "./actions";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import type {
  SerializedPlanExpense,
  SerializedPlanLiability,
} from "./serialized";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
];

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
const ManagedNote = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
  margin: 0;
`;
const ManagedLink = styled.button`
  border: 0;
  background: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
`;

export function ExpenseFields({
  expense,
  managedBy,
  onOpenLiability,
}: {
  expense: SerializedPlanExpense;
  managedBy: SerializedPlanLiability | undefined;
  onOpenLiability: (id: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanExpense) => {
    setError(null);
    try {
      await updatePlanExpense({
        expenseId: next.id,
        label: next.label,
        category: next.category,
        annualAmount: next.annualAmount,
        startAge: next.startAge,
        endAge: next.endAge,
        inflationLinked: next.inflationLinked,
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
        {managedBy ? (
          <ManagedNote>
            Repayment managed by{" "}
            <ManagedLink
              type="button"
              onClick={() => onOpenLiability(managedBy.id)}
            >
              {managedBy.label}
            </ManagedLink>
            {" — timing follows the liability."}
          </ManagedNote>
        ) : null}
        <Field label="Label">
          <TextCell
            value={expense.label}
            onCommit={(v) => save({ ...expense, label: v })}
          />
        </Field>
        {managedBy ? null : (
          <Field label="Category">
            <SelectCell
              value={expense.category}
              options={EXPENSE_CATEGORIES}
              onCommit={(v) => save({ ...expense, category: v })}
            />
          </Field>
        )}
        <Field label="Amount /yr">
          <NumberCell
            value={expense.annualAmount}
            onCommit={(v) =>
              save({ ...expense, annualAmount: v ?? expense.annualAmount })
            }
          />
        </Field>
      </DrawerSection>
      {managedBy ? null : (
        <DrawerSection
          title="Timing"
          summary={`${expense.startAge ?? "now"} → ${expense.endAge ?? "plan end"}`}
        >
          <Field label="Start age (blank = from now)">
            <NumberCell
              value={expense.startAge}
              nullable
              onCommit={(v) => save({ ...expense, startAge: v })}
            />
          </Field>
          <Field label="End age (blank = end of plan)">
            <NumberCell
              value={expense.endAge}
              nullable
              onCommit={(v) => save({ ...expense, endAge: v })}
            />
          </Field>
        </DrawerSection>
      )}
      <DrawerSection
        title="Inflation"
        summary={expense.inflationLinked ? "linked" : "fixed"}
      >
        <Field label="Inflation-linked">
          <BoolCell
            value={expense.inflationLinked}
            onCommit={(v) => save({ ...expense, inflationLinked: v })}
          />
        </Field>
      </DrawerSection>
    </>
  );
}

export function ExpensesTable({
  expenses,
  currency,
  numberFormat,
  onOpen,
}: {
  expenses: SerializedPlanExpense[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanExpense();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Expenses</Heading>
      {expenses.length === 0 ? (
        <Empty>No expenses yet.</Empty>
      ) : (
        <SummaryList>
          {expenses.map((e) => (
            <SummaryRow
              key={e.id}
              primary={e.label}
              secondary={`${e.liabilityId ? "Repayment" : e.category} · ${formatAmount(currency, e.annualAmount, numberFormat)}/yr`}
              onOpen={() => onOpen(e.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add expense" onAdd={add} />
    </Panel>
  );
}

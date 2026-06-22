// src/app/plan/ExpensesTable.tsx
"use client";

import type { ExpenseCategory } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import {
  createPlanExpense,
  deletePlanExpense,
  updatePlanExpense,
} from "./actions";
import type { SerializedPlanExpense } from "./serialized";

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
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.xs}; font-size: 13px; }
  th { color: ${({ theme }) => theme.colors.dim}; font-weight: 500; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;
const Empty = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
`;

function ExpenseRow({ expense }: { expense: SerializedPlanExpense }) {
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

  const remove = async () => {
    setError(null);
    try {
      await deletePlanExpense({ id: expense.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };

  return (
    <>
      <tr>
        <td>
          <TextCell
            value={expense.label}
            onCommit={(v) => save({ ...expense, label: v })}
          />
        </td>
        <td>
          <SelectCell
            value={expense.category}
            options={EXPENSE_CATEGORIES}
            onCommit={(v) => save({ ...expense, category: v })}
          />
        </td>
        <td>
          <NumberCell
            value={expense.annualAmount}
            onCommit={(v) =>
              save({ ...expense, annualAmount: v ?? expense.annualAmount })
            }
          />
        </td>
        <td>
          <NumberCell
            value={expense.startAge}
            nullable
            onCommit={(v) => save({ ...expense, startAge: v })}
          />
        </td>
        <td>
          <NumberCell
            value={expense.endAge}
            nullable
            onCommit={(v) => save({ ...expense, endAge: v })}
          />
        </td>
        <td>
          <BoolCell
            value={expense.inflationLinked}
            onCommit={(v) => save({ ...expense, inflationLinked: v })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={7}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ExpensesTable({
  expenses,
}: { expenses: SerializedPlanExpense[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanExpense();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Expenses</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Category</th>
            <th>Amount /yr</th>
            <th>Start age</th>
            <th>End age</th>
            <th>Inflation-linked</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <Empty>No expenses yet.</Empty>
              </td>
            </tr>
          ) : (
            expenses.map((e) => <ExpenseRow key={e.id} expense={e} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add expense" onAdd={add} />
    </Panel>
  );
}

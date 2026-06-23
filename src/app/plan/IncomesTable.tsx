// src/app/plan/IncomesTable.tsx
"use client";

import type { IncomeKind } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import {
  createPlanIncome,
  deletePlanIncome,
  updatePlanIncome,
} from "./actions";
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
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs}; font-size: 13px; vertical-align: middle; }
  thead th {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.dim};
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  }
  tbody tr:hover td { background: ${({ theme }) => theme.colors.canvasSoft}; }
  input, select { font-variant-numeric: tabular-nums; }
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
const Dash = styled.span`
  color: ${({ theme }) => theme.colors.dim};
`;

function IncomeRow({ income }: { income: SerializedPlanIncome }) {
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

  const remove = async () => {
    setError(null);
    try {
      await deletePlanIncome({ id: income.id });
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
            value={income.label}
            onCommit={(v) => save({ ...income, label: v })}
          />
        </td>
        <td>
          <SelectCell
            value={income.kind}
            options={INCOME_KINDS}
            onCommit={(v) => save({ ...income, kind: v })}
          />
        </td>
        <td>
          <NumberCell
            value={income.annualAmount}
            onCommit={(v) =>
              save({ ...income, annualAmount: v ?? income.annualAmount })
            }
          />
        </td>
        <td>
          <NumberCell
            value={income.startAge}
            nullable
            onCommit={(v) => save({ ...income, startAge: v })}
          />
        </td>
        <td>
          <NumberCell
            value={income.endAge}
            nullable
            onCommit={(v) => save({ ...income, endAge: v })}
          />
        </td>
        <td>
          <SelectCell
            value={income.growthKind}
            options={GROWTH_KINDS}
            onCommit={(v) => save({ ...income, growthKind: v })}
          />
        </td>
        <td>
          {income.growthKind === "FIXED" ? (
            <NumberCell
              value={income.growthPct}
              nullable
              step="0.1"
              onCommit={(v) => save({ ...income, growthPct: v })}
            />
          ) : (
            <Dash>—</Dash>
          )}
        </td>
        <td>
          <BoolCell
            value={income.taxable}
            onCommit={(v) => save({ ...income, taxable: v })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={9}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function IncomesTable({ incomes }: { incomes: SerializedPlanIncome[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanIncome();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Income</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Kind</th>
            <th>Amount /yr</th>
            <th>Start age</th>
            <th>End age</th>
            <th>Growth</th>
            <th>Growth %</th>
            <th>Taxable</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {incomes.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <Empty>No income yet.</Empty>
              </td>
            </tr>
          ) : (
            incomes.map((i) => <IncomeRow key={i.id} income={i} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add income" onAdd={add} />
    </Panel>
  );
}

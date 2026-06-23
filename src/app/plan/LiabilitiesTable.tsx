// src/app/plan/LiabilitiesTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import {
  createPlanLiability,
  deletePlanLiability,
  updatePlanLiability,
} from "./actions";
import type { SerializedPlanLiability } from "./serialized";

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

function LiabilityRow({ liability }: { liability: SerializedPlanLiability }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // `liability` is the committed server value; each cell sends the one field it
  // changed, spread over the latest. On success we refresh the route so the
  // chart + verdict re-render; rethrows so the cell reverts on failure.
  const save = async (next: SerializedPlanLiability) => {
    setError(null);
    try {
      await updatePlanLiability({
        liabilityId: next.id,
        label: next.label,
        openingBalance: next.openingBalance,
        interestPct: next.interestPct,
        monthlyRepayment: next.monthlyRepayment,
        endAge: next.endAge,
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
      await deletePlanLiability({ id: liability.id });
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
            value={liability.label}
            onCommit={(v) => save({ ...liability, label: v })}
          />
        </td>
        <td>
          <NumberCell
            value={liability.openingBalance}
            onCommit={(v) =>
              save({
                ...liability,
                openingBalance: v ?? liability.openingBalance,
              })
            }
          />
        </td>
        <td>
          <NumberCell
            value={liability.interestPct}
            step="0.1"
            onCommit={(v) =>
              save({ ...liability, interestPct: v ?? liability.interestPct })
            }
          />
        </td>
        <td>
          <NumberCell
            value={liability.monthlyRepayment}
            onCommit={(v) =>
              save({
                ...liability,
                monthlyRepayment: v ?? liability.monthlyRepayment,
              })
            }
          />
        </td>
        <td>
          <NumberCell
            value={liability.endAge}
            nullable
            onCommit={(v) => save({ ...liability, endAge: v })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={6}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function LiabilitiesTable({
  liabilities,
}: { liabilities: SerializedPlanLiability[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanLiability();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Liabilities</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Balance</th>
            <th>Interest %</th>
            <th>Repayment /mo</th>
            <th>End age</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {liabilities.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <Empty>No liabilities yet.</Empty>
              </td>
            </tr>
          ) : (
            liabilities.map((l) => <LiabilityRow key={l.id} liability={l} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add liability" onAdd={add} />
    </Panel>
  );
}

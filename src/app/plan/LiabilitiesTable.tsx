// src/app/plan/LiabilitiesTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, TextCell } from "./EditableCell";
import { updatePlanLiability } from "./actions";
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
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.xs}; font-size: 13px; }
  th { color: ${({ theme }) => theme.colors.dim}; font-weight: 500; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
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
      </tr>
      {error ? (
        <tr>
          <td colSpan={5}>
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
  if (liabilities.length === 0) return null;
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
          </tr>
        </thead>
        <tbody>
          {liabilities.map((l) => (
            <LiabilityRow key={l.id} liability={l} />
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

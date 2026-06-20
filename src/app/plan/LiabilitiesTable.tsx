// src/app/plan/LiabilitiesTable.tsx
"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
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
const Cell = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

function LiabilityRow({ liability }: { liability: SerializedPlanLiability }) {
  const [row, setRow] = useState(liability);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanLiability) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanLiability({
          liabilityId: next.id,
          label: next.label,
          openingBalance: next.openingBalance,
          interestPct: next.interestPct,
          monthlyRepayment: next.monthlyRepayment,
          endAge: next.endAge,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };
  const num = (v: string): number => (v === "" ? 0 : Number(v));

  return (
    <>
      <tr>
        <td>
          <Cell
            defaultValue={row.label}
            onBlur={(e) => {
              const n = { ...row, label: e.target.value };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.openingBalance}
            onBlur={(e) => {
              const n = { ...row, openingBalance: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            step="0.1"
            defaultValue={row.interestPct}
            onBlur={(e) => {
              const n = { ...row, interestPct: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.monthlyRepayment}
            onBlur={(e) => {
              const n = { ...row, monthlyRepayment: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.endAge ?? ""}
            onBlur={(e) => {
              const n = {
                ...row,
                endAge: e.target.value === "" ? null : Number(e.target.value),
              };
              setRow(n);
              save(n);
            }}
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

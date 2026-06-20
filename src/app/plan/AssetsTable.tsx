// src/app/plan/AssetsTable.tsx
"use client";

import { WRAPPERS, type Wrapper } from "@/lib/plan";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { updatePlanAsset } from "./actions";
import type { SerializedPlanAsset } from "./serialized";

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
const Sel = styled.select`
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

function AssetRow({ asset }: { asset: SerializedPlanAsset }) {
  const [row, setRow] = useState(asset);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanAsset) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanAsset({
          assetId: next.id,
          label: next.label,
          wrapper: next.wrapper,
          openingValue: next.openingValue,
          expectedReturnPct: next.expectedReturnPct,
          annualContribution: next.annualContribution,
          drawdownPriority: next.drawdownPriority,
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
          <Sel
            value={row.wrapper}
            onChange={(e) => {
              const n = { ...row, wrapper: e.target.value as Wrapper };
              setRow(n);
              save(n);
            }}
          >
            {WRAPPERS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Sel>
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.openingValue}
            onBlur={(e) => {
              const n = { ...row, openingValue: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            step="0.1"
            defaultValue={row.expectedReturnPct ?? ""}
            onBlur={(e) => {
              const n = {
                ...row,
                expectedReturnPct:
                  e.target.value === "" ? null : Number(e.target.value),
              };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.annualContribution}
            onBlur={(e) => {
              const n = { ...row, annualContribution: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
        </td>
        <td>
          <Cell
            type="number"
            defaultValue={row.drawdownPriority}
            onBlur={(e) => {
              const n = { ...row, drawdownPriority: num(e.target.value) };
              setRow(n);
              save(n);
            }}
          />
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

export function AssetsTable({ assets }: { assets: SerializedPlanAsset[] }) {
  return (
    <Panel>
      <Heading>Assets</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Wrapper</th>
            <th>Value</th>
            <th>Return %</th>
            <th>Contribution /yr</th>
            <th>Drawdown order</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

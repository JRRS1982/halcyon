// src/app/plan/AssetsTable.tsx
"use client";

import { WRAPPERS } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
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
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

function AssetRow({ asset }: { asset: SerializedPlanAsset }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // `asset` is the committed server value (refreshed after each save); each cell
  // sends the one field it changed, spread over the latest asset. On success we
  // refresh the route so the server re-runs the engine and the chart + verdict
  // update; rethrows on failure so the cell reverts to the persisted value.
  const save = async (next: SerializedPlanAsset) => {
    setError(null);
    try {
      await updatePlanAsset({
        assetId: next.id,
        label: next.label,
        wrapper: next.wrapper,
        openingValue: next.openingValue,
        expectedReturnPct: next.expectedReturnPct,
        annualContribution: next.annualContribution,
        drawdownPriority: next.drawdownPriority,
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
            value={asset.label}
            onCommit={(v) => save({ ...asset, label: v })}
          />
        </td>
        <td>
          <SelectCell
            value={asset.wrapper}
            options={WRAPPERS}
            onCommit={(v) => save({ ...asset, wrapper: v })}
          />
        </td>
        <td>
          <NumberCell
            value={asset.openingValue}
            onCommit={(v) =>
              save({ ...asset, openingValue: v ?? asset.openingValue })
            }
          />
        </td>
        <td>
          <NumberCell
            value={asset.expectedReturnPct}
            nullable
            step="0.1"
            onCommit={(v) => save({ ...asset, expectedReturnPct: v })}
          />
        </td>
        <td>
          <NumberCell
            value={asset.annualContribution}
            onCommit={(v) =>
              save({
                ...asset,
                annualContribution: v ?? asset.annualContribution,
              })
            }
          />
        </td>
        <td>
          <NumberCell
            value={asset.drawdownPriority}
            onCommit={(v) =>
              save({ ...asset, drawdownPriority: v ?? asset.drawdownPriority })
            }
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

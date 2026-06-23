// src/app/plan/AssetsTable.tsx
"use client";

import { WRAPPERS } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanAsset, updatePlanAsset } from "./actions";
import type { SerializedPlanAsset } from "./serialized";

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

// ── Drawer form ──────────────────────────────────────────────────────────
export function AssetFields({ asset }: { asset: SerializedPlanAsset }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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
        contributionEndAge: next.contributionEndAge,
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
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell
            value={asset.label}
            onCommit={(v) => save({ ...asset, label: v })}
          />
        </Field>
        <Field label="Account type">
          <SelectCell
            value={asset.wrapper}
            options={WRAPPERS}
            onCommit={(v) => save({ ...asset, wrapper: v })}
          />
        </Field>
        <Field label="Current value">
          <NumberCell
            value={asset.openingValue}
            onCommit={(v) =>
              save({ ...asset, openingValue: v ?? asset.openingValue })
            }
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Growth">
        <Field label="Expected return %">
          <NumberCell
            value={asset.expectedReturnPct}
            nullable
            step="0.1"
            onCommit={(v) => save({ ...asset, expectedReturnPct: v })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Contributions">
        <Field label="Amount /yr">
          <NumberCell
            value={asset.annualContribution}
            onCommit={(v) =>
              save({
                ...asset,
                annualContribution: v ?? asset.annualContribution,
              })
            }
          />
        </Field>
        <Field label="Contribute until age (blank = retirement)">
          <NumberCell
            value={asset.contributionEndAge}
            nullable
            onCommit={(v) => save({ ...asset, contributionEndAge: v })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Drawdown">
        <Field label="Draw order">
          <NumberCell
            value={asset.drawdownPriority}
            onCommit={(v) =>
              save({ ...asset, drawdownPriority: v ?? asset.drawdownPriority })
            }
          />
        </Field>
      </DrawerSection>
    </>
  );
}

// ── Summary list ─────────────────────────────────────────────────────────
export function AssetsTable({
  assets,
  currency,
  numberFormat,
  onOpen,
}: {
  assets: SerializedPlanAsset[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanAsset();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Assets</Heading>
      {assets.length === 0 ? (
        <Empty>No assets yet.</Empty>
      ) : (
        <SummaryList>
          {assets.map((a) => (
            <SummaryRow
              key={a.id}
              primary={a.label}
              secondary={`${a.wrapper} · ${formatAmount(currency, a.openingValue, numberFormat)}`}
              onOpen={() => onOpen(a.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add asset" onAdd={add} />
    </Panel>
  );
}

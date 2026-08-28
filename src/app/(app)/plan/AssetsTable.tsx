// src/app/plan/AssetsTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { WRAPPERS } from "@/lib/plan";
import type { SyncPlan } from "@/lib/plan/sync";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { AddAssetDrawer } from "./AddAssetDrawer";
import { updatePlanAsset } from "./actions";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { MortgageBadge } from "./MortgageBadge";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { rowMarkerProps, SyncMarker } from "./SyncMarker";
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
        feePct: next.feePct,
        annualContribution: next.annualContribution,
        contributionEndAge: next.contributionEndAge,
        minAccessAge: next.minAccessAge,
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
      <DrawerSection
        title="Growth"
        summary={
          (asset.expectedReturnPct !== null
            ? `${asset.expectedReturnPct}%`
            : "default") + (asset.feePct > 0 ? ` · ${asset.feePct}% fee` : "")
        }
      >
        <Field label="Expected return %">
          <NumberCell
            value={asset.expectedReturnPct}
            nullable
            step="0.1"
            onCommit={(v) => save({ ...asset, expectedReturnPct: v })}
          />
        </Field>
        <Field label="Fees / charges %">
          <NumberCell
            value={asset.feePct}
            step="0.1"
            onCommit={(v) => save({ ...asset, feePct: v ?? asset.feePct })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection
        title="Contributions"
        summary={
          asset.annualContribution > 0
            ? `${asset.annualContribution.toLocaleString()}/yr`
            : "none"
        }
      >
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
      <DrawerSection
        title="Drawdown"
        summary={`order ${asset.drawdownPriority}`}
      >
        <Field label="Draw order">
          <NumberCell
            value={asset.drawdownPriority}
            onCommit={(v) =>
              save({ ...asset, drawdownPriority: v ?? asset.drawdownPriority })
            }
          />
        </Field>
        {asset.wrapper === "PENSION" ? (
          <Field label="Earliest access age">
            <NumberCell
              value={asset.minAccessAge ?? 57}
              nullable
              onCommit={(v) => save({ ...asset, minAccessAge: v })}
            />
          </Field>
        ) : null}
      </DrawerSection>
    </>
  );
}

// ── Summary list ─────────────────────────────────────────────────────────
export function AssetsTable({
  assets,
  currency,
  numberFormat,
  syncPreview,
  unlinkedMortgages,
  onOpen,
}: {
  assets: SerializedPlanAsset[];
  currency: string;
  numberFormat: NumberFormat;
  syncPreview: SyncPlan;
  /** Mortgages with no property yet — offered as a link when adding one. */
  unlinkedMortgages: { id: string; label: string }[];
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const onCreated = (id: string) => {
    setAddOpen(false);
    // Select before refreshing, not after: router.refresh() runs inside a
    // React transition, and a setState queued behind it waits on the server
    // round trip it starts. The selection does not depend on that payload.
    onOpen(id);
    router.refresh();
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
              badge={
                a.wrapper === "PROPERTY" ? (
                  <MortgageBadge>Property</MortgageBadge>
                ) : undefined
              }
              marker={
                <SyncMarker
                  {...rowMarkerProps(
                    a.id,
                    syncPreview,
                    currency,
                    numberFormat,
                    {
                      value: a.openingValue,
                      flow: a.annualContribution,
                    },
                  )}
                />
              }
              onOpen={() => onOpen(a.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add asset" onAdd={() => setAddOpen(true)} />
      <AddAssetDrawer
        open={addOpen}
        unlinkedMortgages={unlinkedMortgages}
        onClose={() => setAddOpen(false)}
        onCreated={onCreated}
      />
    </Panel>
  );
}

// src/app/plan/LiabilitiesTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "@/components/ui/Drawer";
import type { SyncPlan } from "@/lib/plan/sync";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { AddLiabilityDrawer } from "./AddLiabilityDrawer";
import {
  linkRepaymentExpense,
  unlinkRepaymentExpense,
  updatePlanLiability,
} from "./actions";
import { NumberCell, TextCell } from "./EditableCell";
import { MortgageBadge } from "./MortgageBadge";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { rowMarkerProps, SyncMarker } from "./SyncMarker";
import type {
  SerializedPlanExpense,
  SerializedPlanLiability,
} from "./serialized";

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
const LinkedRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`;
const LinkedButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.body};
  font-size: 12px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  width: fit-content;
`;

export function LiabilityFields({
  liability,
  linkedExpense,
  onOpenExpense,
}: {
  liability: SerializedPlanLiability;
  linkedExpense: SerializedPlanExpense | undefined;
  onOpenExpense: (id: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanLiability) => {
    setError(null);
    try {
      await updatePlanLiability({
        liabilityId: next.id,
        label: next.label,
        openingBalance: next.openingBalance,
        interestPct: next.interestPct,
        monthlyRepayment: next.monthlyRepayment,
        startAge: next.startAge,
        endAge: next.endAge,
        linkedAssetId: next.linkedAssetId,
        interestOnly: next.interestOnly,
        revisionAge: next.revisionAge,
        revisionRate: next.revisionRate,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const link = async () => {
    setError(null);
    try {
      const id = await linkRepaymentExpense({ liabilityId: liability.id });
      router.refresh();
      onOpenExpense(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link");
    }
  };

  const unlink = async () => {
    if (!linkedExpense) return;
    setError(null);
    try {
      await unlinkRepaymentExpense({ id: linkedExpense.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlink");
    }
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell
            value={liability.label}
            onCommit={(v) => save({ ...liability, label: v })}
          />
        </Field>
        <Field label="Balance">
          <NumberCell
            value={liability.openingBalance}
            onCommit={(v) =>
              save({
                ...liability,
                openingBalance: v ?? liability.openingBalance,
              })
            }
          />
        </Field>
      </DrawerSection>
      <DrawerSection
        title="Terms"
        summary={`${liability.interestPct}%${
          linkedExpense
            ? ` · ${Math.round(linkedExpense.annualAmount / 12).toLocaleString()}/mo`
            : liability.monthlyRepayment > 0
              ? ` · ${liability.monthlyRepayment.toLocaleString()}/mo`
              : ""
        }${liability.interestOnly ? " · interest-only" : ""}`}
      >
        <Field label="Interest %">
          <NumberCell
            value={liability.interestPct}
            step="0.1"
            onCommit={(v) =>
              save({ ...liability, interestPct: v ?? liability.interestPct })
            }
          />
        </Field>
        {linkedExpense ? (
          <Field label="Repayment (managed by expense)">
            <LinkedRow>
              <LinkedButton
                type="button"
                onClick={() => onOpenExpense(linkedExpense.id)}
              >
                {`${Math.round(linkedExpense.annualAmount / 12)}/mo — edit expense`}
              </LinkedButton>
              <LinkedButton type="button" onClick={unlink}>
                Unlink
              </LinkedButton>
            </LinkedRow>
          </Field>
        ) : (
          <>
            <Field label="Repayment /mo">
              <NumberCell
                value={liability.monthlyRepayment}
                onCommit={(v) =>
                  save({
                    ...liability,
                    monthlyRepayment: v ?? liability.monthlyRepayment,
                  })
                }
              />
            </Field>
            <LinkedButton type="button" onClick={link}>
              Track repayment as an expense
            </LinkedButton>
          </>
        )}
        <Field label="Fixed until age (blank = never changes)">
          <NumberCell
            value={liability.revisionAge}
            nullable
            onCommit={(v) => save({ ...liability, revisionAge: v })}
          />
        </Field>
        <Field label="Rate after that %">
          <NumberCell
            value={liability.revisionRate}
            nullable
            step="0.1"
            onCommit={(v) => save({ ...liability, revisionRate: v })}
          />
        </Field>
        <Field label="Starts at age (blank = now)">
          <NumberCell
            value={liability.startAge}
            nullable
            onCommit={(v) => save({ ...liability, startAge: v })}
          />
        </Field>
        <Field label="Paid off by age (blank = none)">
          <NumberCell
            value={liability.endAge}
            nullable
            onCommit={(v) => save({ ...liability, endAge: v })}
          />
        </Field>
      </DrawerSection>
    </>
  );
}

export function LiabilitiesTable({
  liabilities,
  currency,
  numberFormat,
  syncPreview,
  unmortgagedProperties,
  onOpen,
  onOpenProperty,
}: {
  liabilities: SerializedPlanLiability[];
  currency: string;
  numberFormat: NumberFormat;
  syncPreview: SyncPlan;
  /** Properties with no mortgage yet — offered as a link when adding one. */
  unmortgagedProperties: { id: string; label: string }[];
  onOpen: (id: string) => void;
  onOpenProperty: (assetId: string) => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const onCreated = (created: {
    liabilityId: string;
    linkedAssetId: string | null;
  }) => {
    setAddOpen(false);
    // Select before refreshing, not after: router.refresh() runs inside a
    // React transition, and a setState queued behind it waits on the server
    // round trip it starts. The selection does not depend on that payload.
    // A mortgage opens its property card, which shows the property and the
    // mortgage together; anything else opens itself.
    if (created.linkedAssetId) onOpenProperty(created.linkedAssetId);
    else onOpen(created.liabilityId);
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Liabilities</Heading>
      {liabilities.length === 0 ? (
        <Empty>No liabilities yet.</Empty>
      ) : (
        <SummaryList>
          {liabilities.map((l) => (
            <SummaryRow
              key={l.id}
              primary={l.label}
              secondary={`${formatAmount(currency, l.openingBalance, numberFormat)} · ${l.interestPct}%`}
              badge={
                l.linkedAssetId ? (
                  <MortgageBadge>Mortgage</MortgageBadge>
                ) : undefined
              }
              marker={
                <SyncMarker
                  {...rowMarkerProps(
                    l.id,
                    syncPreview,
                    currency,
                    numberFormat,
                    {
                      value: l.openingBalance,
                      flow: l.monthlyRepayment,
                    },
                  )}
                />
              }
              onOpen={() => onOpen(l.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add liability" onAdd={() => setAddOpen(true)} />
      <AddLiabilityDrawer
        open={addOpen}
        unmortgagedProperties={unmortgagedProperties}
        onClose={() => setAddOpen(false)}
        onCreated={onCreated}
      />
    </Panel>
  );
}

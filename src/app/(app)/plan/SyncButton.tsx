// src/app/plan/SyncButton.tsx
"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import {
  confirmableRemovals,
  type SyncPlan,
  syncChangeCount,
} from "@/lib/plan/sync";
import { SyncRemovalDialog } from "./SyncRemovalDialog";
import { syncPlan } from "./syncActions";

const Wrap = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  justify-items: start;
`;
const Btn = styled.button`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  line-height: 1;
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  cursor: pointer;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onPrimary};
  border: 1px solid ${({ theme }) => theme.colors.accent};
  transition: opacity 100ms;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }
  &:disabled {
    cursor: not-allowed;
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.dim};
    border-color: ${({ theme }) => theme.colors.hairline};
  }
`;
const Breakdown = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

// X updated · Y added · Z removed — any zero part omitted.
function breakdownOf(plan: SyncPlan): string {
  const parts = [
    plan.updates.length > 0 ? `${plan.updates.length} updated` : null,
    plan.additions.length > 0 ? `${plan.additions.length} added` : null,
    plan.removals.length > 0 ? `${plan.removals.length} removed` : null,
  ].filter((p): p is string => p !== null);
  return parts.join(" · ");
}

export function SyncButton({
  preview,
  onSynced,
}: {
  preview: SyncPlan;
  onSynced: (result: SyncPlan) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const count = syncChangeCount(preview);

  const performSync = () => {
    startTransition(async () => {
      const result = await syncPlan();
      onSynced(result);
    });
  };

  // The rule itself lives in sync.ts, beside the resolver that decides the
  // removals: a "gone" row was already confirmed on the balance sheet's own
  // delete panel and does not gate, but a plan-only row — and anything a
  // removal drags with it — has had no warning from anywhere.
  const mustConfirm = confirmableRemovals(preview.removals).length > 0;

  const onClick = () => {
    if (mustConfirm) {
      setConfirming(true);
      return;
    }
    performSync();
  };

  const onConfirm = () => {
    setConfirming(false);
    performSync();
  };

  if (count === 0) {
    return (
      <Wrap>
        <Btn type="button" disabled>
          Up to date
        </Btn>
      </Wrap>
    );
  }

  const label = `Sync with latest — ${count} ${count === 1 ? "change" : "changes"}`;

  return (
    <Wrap>
      <Btn type="button" onClick={onClick} disabled={pending}>
        {label}
      </Btn>
      <Breakdown>{breakdownOf(preview)}</Breakdown>
      {confirming ? (
        <SyncRemovalDialog
          removals={preview.removals}
          onCancel={() => setConfirming(false)}
          onConfirm={onConfirm}
        />
      ) : null}
    </Wrap>
  );
}

// src/app/plan/SyncButton.tsx
"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import {
  confirmableRemovals,
  type SyncPlan,
  syncChangeCount,
} from "@/lib/plan/sync";
import { SyncRemovalDialog } from "./SyncRemovalDialog";
import { syncPlan } from "./syncActions";

// Right-aligned in the lists' header, so the button and its breakdown sit at
// the end of the line that says what the plan is built from.
const Wrap = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  justify-items: end;
`;
// Nothing to sync is a state, not an action: words, not a dead button. It
// used to be a disabled "Up to date" button, which read as broken and never
// said what it was up to date with.
const UpToDate = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
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
        <UpToDate role="status">
          ✓ Up to date with your accounts and budget
        </UpToDate>
      </Wrap>
    );
  }

  const label = `Sync with latest — ${count} ${count === 1 ? "change" : "changes"}`;

  return (
    <Wrap>
      <Button type="button" onClick={onClick} disabled={pending}>
        {label}
      </Button>
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

// src/app/plan/SyncButton.tsx
"use client";

import { useTransition } from "react";
import styled from "styled-components";
import { type SyncPlan, syncChangeCount } from "@/lib/plan/sync";
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
  const count = syncChangeCount(preview);

  const onClick = () => {
    startTransition(async () => {
      const result = await syncPlan();
      onSynced(result);
    });
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
    </Wrap>
  );
}

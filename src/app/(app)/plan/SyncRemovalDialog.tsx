"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import type { SyncPlan } from "@/lib/plan/sync";

type Removal = SyncPlan["removals"][number];

// ─── Chrome (focus-trap pattern copied from balance/AddAccountDrawer.tsx —
// same Tab-trap-both-directions/Esc/body-scroll-lock/focus-restore effect,
// kept local to this feature rather than imported cross-feature). This
// dialog has no open/closed state of its own: the caller only mounts it
// while it should be shown, so — unlike the drawer — there is no `$open`
// transition to drive. ────────────────────────────────────────────────────

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 22, 0.22);
  z-index: 40;
`;

const Box = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, 94vw);
  max-height: min(80vh, 560px);
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.negative};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 24px 64px rgba(15, 17, 22, 0.22);
  padding: ${({ theme }) => theme.spacing.xl};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  z-index: 50;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

const RowList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Row = styled.li`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Text = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

// "N plan-only rows" and/or "N rows no longer on your balance sheet" — the
// two reasons resolvePlanSync ever produces, joined only when both occur.
function describeRemovals(removals: Removal[]): string {
  const planOnly = removals.filter((r) => r.reason === "plan-only").length;
  const gone = removals.filter((r) => r.reason === "gone").length;

  const parts = [
    planOnly > 0
      ? `${planOnly} plan-only ${planOnly === 1 ? "row" : "rows"}`
      : null,
    gone > 0
      ? `${gone} ${gone === 1 ? "row" : "rows"} no longer on your balance sheet`
      : null,
  ].filter((p): p is string => p !== null);

  return parts.join(" and ");
}

export function SyncRemovalDialog({
  removals,
  onCancel,
  onConfirm,
}: {
  removals: Removal[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  // While mounted: Esc cancels; Tab is trapped within the box; body scroll is
  // locked; focus moves into the box. On unmount, focus returns to whatever
  // triggered it (the Sync button). Mirrors balance/AddAccountDrawer.tsx.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const box = boxRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const focusables = box.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, []);

  const description = describeRemovals(removals);
  const heading = `Sync will remove ${description}`;

  return (
    <>
      <Scrim aria-hidden="true" />
      <Box ref={boxRef} role="alertdialog" aria-label={heading} tabIndex={-1}>
        <Title>{heading}</Title>
        <RowList>
          {removals.map((removal) => (
            <Row key={removal.id}>{removal.label}</Row>
          ))}
        </RowList>
        <Text>
          These aren&rsquo;t on your balance sheet or budget, so Sync has
          nothing to update them from. You can add them again afterwards.
        </Text>
        <Actions>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Sync anyway
          </Button>
        </Actions>
      </Box>
    </>
  );
}

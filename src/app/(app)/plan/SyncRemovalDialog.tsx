"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { confirmableRemovals, type SyncRemoval } from "@/lib/plan/sync";

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

const GoesWith = styled.span`
  color: ${({ theme }) => theme.colors.dim};
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

const rows = (n: number): string => (n === 1 ? "row" : "rows");

// "2 plan-only rows and 1 attached row". Two counts because they are two
// different losses: a plan-only row exists nowhere else, while an attached one
// is going because something it cannot outlive is going — a mortgage without
// its property, a repayment without its debt, a sale without something to
// sell. The zero part is omitted, so the common case still reads exactly
// "1 plan-only row".
function describeRemovals(removals: SyncRemoval[]): string {
  const planOnly = removals.filter((r) => r.reason === "plan-only").length;
  const attached = removals.filter((r) => r.reason === "cascade").length;
  return [
    planOnly > 0 ? `${planOnly} plan-only ${rows(planOnly)}` : null,
    attached > 0 ? `${attached} attached ${rows(attached)}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" and ");
}

export function SyncRemovalDialog({
  removals,
  onCancel,
  onConfirm,
}: {
  /** The Sync's whole removal list — this dialog decides which of them to name. */
  removals: SyncRemoval[];
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

  // The dialog is handed every removal and names the ones that need naming,
  // rather than the caller pre-filtering: it also needs the rest to say what
  // an attached row is going with, and that row is usually a "gone" one.
  const named = confirmableRemovals(removals);
  const labelById = new Map(removals.map((r) => [r.id, r.label]));
  const heading = `Sync will remove ${describeRemovals(named)}`;

  return (
    <>
      <Scrim aria-hidden="true" />
      <Box ref={boxRef} role="alertdialog" aria-label={heading} tabIndex={-1}>
        <Title>{heading}</Title>
        <RowList>
          {named.map((removal) => {
            const goesWith =
              removal.dependsOn === null
                ? null
                : labelById.get(removal.dependsOn);
            return (
              <Row key={removal.id}>
                {removal.label}
                {goesWith ? <GoesWith> — goes with {goesWith}</GoesWith> : null}
              </Row>
            );
          })}
        </RowList>
        <Text>
          Plan-only rows aren&rsquo;t on your balance sheet or budget, so Sync
          has nothing to update them from. Attached rows can&rsquo;t outlive
          what they belong to. You can add them again afterwards.
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

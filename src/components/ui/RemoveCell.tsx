// src/components/ui/RemoveCell.tsx
//
// A "Remove" link that turns into an inline Yes/Cancel confirmation on click,
// rather than opening a separate dialog. Shared UI: it started as one of
// plan/RowControls.tsx's two exports, but carried no plan types or imports —
// only Drawer's default footer used it, so it moved out to sit next to the
// component that actually consumes it.
"use client";

import { useState } from "react";
import styled from "styled-components";

const LinkBtn = styled.button`
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  padding: 0;
  text-decoration: underline;
`;
// The one that deletes says so, in the warning colour, so the two choices
// can't be told apart only by their position.
const YesBtn = styled(LinkBtn)`
  color: ${({ theme }) => theme.colors.negative};
  font-weight: 600;
`;
const Confirm = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;
`;

export function RemoveCell({
  onConfirm,
  confirmLabel = "Remove?",
}: {
  onConfirm: () => Promise<void> | void;
  /** Says what else goes with it, when removing one row removes others. */
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <LinkBtn type="button" onClick={() => setConfirming(true)}>
        Remove
      </LinkBtn>
    );
  }

  const yes = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Confirm>
      {confirmLabel}
      <YesBtn type="button" onClick={yes} disabled={busy}>
        Yes, remove
      </YesBtn>
      <LinkBtn
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        Cancel
      </LinkBtn>
    </Confirm>
  );
}

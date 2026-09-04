// src/components/ui/RemoveCell.tsx
//
// A "Remove" link that turns into an inline yes/cancel confirmation on click,
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
const Confirm = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
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
      <LinkBtn type="button" onClick={yes} disabled={busy}>
        yes
      </LinkBtn>
      /
      <LinkBtn
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        cancel
      </LinkBtn>
    </Confirm>
  );
}

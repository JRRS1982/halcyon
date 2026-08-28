// src/app/plan/RowControls.tsx
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
const AddBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  width: fit-content;
`;
const Confirm = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: center;
`;

export function AddRowButton({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      await onAdd();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AddBtn type="button" onClick={add} disabled={busy}>
      + {label}
    </AddBtn>
  );
}

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

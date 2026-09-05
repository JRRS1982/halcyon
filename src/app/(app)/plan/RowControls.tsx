// src/app/plan/RowControls.tsx
"use client";

import { useState } from "react";
import styled from "styled-components";

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

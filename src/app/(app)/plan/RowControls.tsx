// src/app/plan/RowControls.tsx
"use client";

import { useState } from "react";
import styled from "styled-components";

// The same outline button as the sheets' "+ Add": a faint 13px box read as
// disabled beside the plan's rows.
const AddBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.ink};
  background: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  font-weight: ${({ theme }) => theme.typography.control.weight};
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

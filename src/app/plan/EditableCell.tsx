// src/app/plan/EditableCell.tsx
"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";

// Controlled inline inputs for the plan editors. They commit on blur and:
//  - re-sync to the committed `value` when it changes (after a successful save
//    + revalidate, or any external update) — primitive dep, so an in-flight
//    edit is never clobbered (the committed value only moves once a save lands);
//  - revert (and DON'T save) when a required field is cleared — so clearing a
//    number to retype it never silently persists 0;
//  - commit null when a nullable field is cleared;
//  - revert on a rejected save, so the input reflects the persisted value.

const Input = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;

const fmtNum = (v: number | null): string => (v === null ? "" : String(v));

export function NumberCell({
  value,
  nullable = false,
  step,
  onCommit,
}: {
  value: number | null;
  nullable?: boolean;
  step?: string;
  onCommit: (value: number | null) => Promise<void> | void;
}) {
  const [buf, setBuf] = useState<string>(fmtNum(value));
  useEffect(() => {
    setBuf(fmtNum(value));
  }, [value]);

  const commit = async () => {
    const trimmed = buf.trim();
    if (trimmed === "") {
      if (nullable) {
        if (value === null) return;
        await onCommit(null);
        return;
      }
      setBuf(fmtNum(value)); // required field cleared → revert, never save 0
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      setBuf(fmtNum(value));
      return;
    }
    if (n === value) return;
    try {
      await onCommit(n);
    } catch {
      setBuf(fmtNum(value));
    }
  };

  return (
    <Input
      type="number"
      step={step}
      value={buf}
      onChange={(e) => setBuf(e.target.value)}
      onBlur={commit}
    />
  );
}

export function SelectCell<T extends string>({
  value,
  options,
  onCommit,
}: {
  value: T;
  options: readonly T[];
  onCommit: (value: T) => Promise<void> | void;
}) {
  const [buf, setBuf] = useState<T>(value);
  useEffect(() => {
    setBuf(value);
  }, [value]);

  const change = async (next: T) => {
    if (next === value) return;
    setBuf(next); // optimistic
    try {
      await onCommit(next);
    } catch {
      setBuf(value);
    }
  };

  return (
    <Select value={buf} onChange={(e) => change(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  );
}

export function TextCell({
  value,
  type = "text",
  onCommit,
}: {
  value: string;
  type?: "text" | "date";
  onCommit: (value: string) => Promise<void> | void;
}) {
  const [buf, setBuf] = useState<string>(value);
  useEffect(() => {
    setBuf(value);
  }, [value]);

  const commit = async () => {
    if (buf.trim() === "") {
      setBuf(value); // required → revert
      return;
    }
    if (buf === value) return;
    try {
      await onCommit(buf);
    } catch {
      setBuf(value);
    }
  };

  return (
    <Input
      type={type}
      value={buf}
      onChange={(e) => setBuf(e.target.value)}
      onBlur={commit}
    />
  );
}

export function BoolCell({
  value,
  onCommit,
}: {
  value: boolean;
  onCommit: (value: boolean) => Promise<void> | void;
}) {
  // Fully controlled by `value`: on a successful save the committed prop
  // re-renders the box; on a rejected save the row's `setError` re-render
  // restores the old `value`, reverting it. We catch here so the rejected
  // save (which the row rethrows so cells can revert) isn't an unhandled
  // promise rejection — the row already surfaces the error message.
  const handle = async (checked: boolean) => {
    try {
      await onCommit(checked);
    } catch {
      // row shows the error; controlled `value` reverts on the next render
    }
  };
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => handle(e.target.checked)}
    />
  );
}

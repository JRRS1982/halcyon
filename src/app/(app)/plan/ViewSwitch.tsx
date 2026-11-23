// src/app/plan/ViewSwitch.tsx
"use client";

import styled from "styled-components";

// The plan's view picker, shared by the chart views and the record lists. It
// reads as the masthead's nav does: words on a rule, the chosen one in the
// accent and underlined. No frame or filled pill — a box around a few words
// made the control louder than what it switches.
const Switcher = styled.fieldset`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${({ theme }) => theme.spacing.xl};
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const Tab = styled.button<{ $active: boolean }>`
  margin-bottom: -1px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-bottom: 3px solid
    ${({ $active, theme }) => ($active ? theme.colors.accent : "transparent")};
  background: transparent;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  font-weight: ${({ theme }) => theme.typography.control.weight};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.accent : theme.colors.ink};

  &:hover {
    border-bottom-color: ${({ $active, theme }) =>
      $active ? theme.colors.accent : theme.colors.hairlineStrong};
  }
`;

// How many rows a list holds, so the closed tabs still say what is in them.
// Set apart by a real space rather than a margin, so the tab is named
// "Liabilities 2", not "Liabilities2", to a screen reader.
const Count = styled.span`
  font-weight: 400;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

export type ViewOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function ViewSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** The group's accessible name, e.g. "Chart view". */
  label: string;
  options: readonly ViewOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <Switcher aria-label={label}>
      {options.map((option) => (
        <Tab
          key={option.id}
          type="button"
          $active={value === option.id}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count === undefined ? null : (
            <>
              {" "}
              <Count>{option.count}</Count>
            </>
          )}
        </Tab>
      ))}
    </Switcher>
  );
}

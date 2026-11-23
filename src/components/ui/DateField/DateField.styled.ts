import styled from "styled-components";
import { visuallyHidden } from "@/lib/visuallyHidden";

// One field in three parts, in every use: day, month and year typed onto a
// single boxed strip divided by slashes, with the calendar inside the same
// edge, so a date reads as one entry rather than three. Three sizes:
//   - compact (default): sized to its digits, with a panel's 13px label, so it
//     keeps to a dense column (the plan's assumptions);
//   - $wide: full width under a form label at a field's 36px, as in a drawer;
//   - $standalone: $wide at a 44px touch height with larger digits, for the
//     first-run card where the date is the only question.
// In a panel it is sized to its digits so it keeps to its column.
//
// The surface is the row's, not the parts', so a panel that restyles its
// fields (the plan's assumptions) styles this row via [data-date-row].

export const Group = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
`;

// A form label, as on every other form: control type above the field. In a
// panel it matches the panel's own labels instead.
export const Legend = styled.legend<{ $wide?: boolean }>`
  padding: 0;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  ${({ theme, $wide }) =>
    $wide
      ? `
    font-family: ${theme.typography.control.family};
    font-size: ${theme.typography.control.size};
    font-weight: ${theme.typography.control.weight};
    color: ${theme.colors.body};
  `
      : `font-size: 13px; color: ${theme.colors.body};`}
`;

export const Row = styled.div<{ $wide?: boolean; $standalone?: boolean }>`
  display: ${({ $wide }) => ($wide ? "flex" : "inline-flex")};
  align-items: center;
  min-height: ${({ $standalone }) => ($standalone ? "44px" : "36px")};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background-color: ${({ theme }) => theme.colors.field};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.focus};
    box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.focus};
  }
`;

// The "/" between parts: drawn, not typed, so it is hidden from assistive
// tech, which reads each part's own name instead.
export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  user-select: none;
`;

export const Part = styled.label`
  display: grid;
`;

// The DD / MM / YYYY placeholders say which part is which, so the words are
// redundant on screen — but a placeholder is not a label, and without these
// the fields are three unnamed boxes to a screen reader. Hidden, not deleted.
export const PartName = styled.span`
  ${visuallyHidden}
`;

// Sized to what they hold — two characters, two, four — rather than filling the
// row. The width counts characters with the padding on top (in ems alone, the
// four-digit year lost its last digit to the padding), and is measured for the
// placeholder, not the digits: "MM" is wider than "06" and was cut to "MN".
export const PartInput = styled.input<{
  $wide?: boolean;
  $standalone?: boolean;
}>`
  width: ${({ $wide, theme }) =>
    `calc(${$wide ? "5ch" : "3.2ch"} + 2 * ${theme.spacing.xs})`};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: transparent;
  outline: none;
  font: inherit;
  font-size: ${({ $standalone, theme }) =>
    $standalone ? "16px" : theme.typography.bodyMd.size};
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};

  &::placeholder {
    color: ${({ theme }) => theme.colors.dim};
  }
`;

// Opens the browser's own calendar, which is only a problem when it also
// supplies the *text* — and it no longer does. At the strip's right end.
export const PickerButton = styled.button`
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: none;
  color: ${({ theme }) => theme.colors.body};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
`;

// Present for its calendar only: the three parts are what the user reads and
// types into, so this never needs to be seen.
export const HiddenDateInput = styled.input`
  ${visuallyHidden}
`;

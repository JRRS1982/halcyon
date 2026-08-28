import styled from "styled-components";

export const Group = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
`;
// Standalone, this is the card's question and carries weight. In a panel it is
// one label among many, so it matches them exactly — 13px in the body colour,
// the same as the panel's own Field.
export const Legend = styled.legend<{ $standalone?: boolean }>`
  padding: 0;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  ${({ theme, $standalone }) =>
    $standalone
      ? "width: 100%; text-align: center; font-size: 1.2em;"
      : `font-size: 13px; color: ${theme.colors.body};`}
`;
export const Row = styled.div<{ $standalone?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
  justify-content: ${({ $standalone }) =>
    $standalone ? "center" : "flex-start"};
`;
// Sized to what they hold — two digits, two digits, four — rather than filling
// the row. A box far wider than its content invites the wrong input.
export const Part = styled.label`
  display: grid;
`;
// The DD / MM / YYYY placeholders say which box is which, so the words are
// redundant on screen — but a placeholder is not a label, and without these
// the fields are three unnamed boxes to a screen reader. Hidden, not deleted.
export const PartName = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
// The panel's grid gives each field a 180px column, and the standalone card
// gives it a whole row — so the compact sizes are what keep the group inside
// its column instead of over its neighbour.
export const PartInput = styled.input<{
  $wide?: boolean;
  $standalone?: boolean;
}>`
  width: ${({ $wide, $standalone }) =>
    $standalone ? ($wide ? "5.5em" : "3.75em") : $wide ? "3.4em" : "2.6em"};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme, $standalone }) =>
    $standalone ? theme.spacing.md : theme.spacing.xs};
  font: inherit;
  font-size: ${({ $standalone }) => ($standalone ? "1.05em" : "13px")};
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;
// Opens the browser's own calendar, which is only a problem when it also
// supplies the *text* — and it no longer does. Aligned to the inputs rather
// than the row, so it sits level with them under their little labels.
export const PickerButton = styled.button<{ $standalone?: boolean }>`
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme, $standalone }) =>
    $standalone ? theme.spacing.md : theme.spacing.xs};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: none;
  color: ${({ theme }) => theme.colors.body};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
`;
// Present for its calendar only: the three fields above are what the user
// reads and types into, so this never needs to be seen.
export const HiddenDateInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

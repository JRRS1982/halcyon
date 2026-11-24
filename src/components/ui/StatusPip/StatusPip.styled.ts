import styled, { css } from "styled-components";

export type StatusPipState = "saved" | "saving" | "error";

const dotColor = {
  saved: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.positive,
  saving: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.bodyMuted,
  error: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.negative,
};

// Status, not a control: a dot and caps words, with no box. The hairline box it
// used to sit in made it read as a disabled button, beside toolbar buttons that
// now carry a fill of their own; the phone layout had already dropped it for
// that reason.
export const PipWrapper = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    color: ${theme.colors.body};
    /* The toolbar buttons' height, so it sits level in the toolbar row. */
    height: 30px;
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    line-height: 1;
    /* A stable width, so the toolbar does not shift as the label cycles
       (Saving… → Saved just now → Saved 3m ago → Up to date). The words sit
       at its right end, against the sheet's edge. */
    min-width: 132px;
    justify-content: flex-end;

    @media (max-width: 767px) {
      height: auto;
      min-width: 0;
    }
  `}
`;

export const PipDot = styled.span<{ $state: StatusPipState }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => dotColor[props.$state](props)};
  flex-shrink: 0;
`;

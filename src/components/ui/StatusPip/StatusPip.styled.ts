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

export const PipWrapper = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    /* Match the toolbar buttons' height/format so the pill sits flush in the
       toolbar row rather than looking short. */
    height: 30px;
    padding: 0 ${theme.spacing.md};
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    line-height: 1;
    /* Reserve a stable width so the pill doesn't resize as its label cycles
       (Saving… → Saved just now → Saved 3m ago → Up to date). The slack that
       reserve leaves on a short label is shared between both ends rather than
       pushed to one — flex-end parked "Up to date" against the right edge
       behind 45px of empty pill, which read as a spacing bug. */
    min-width: 132px;
    justify-content: center;

    /* On a phone the pip is status, not a control — the chip chrome made it
       read as one more button in the wrapped toolbar. Bare mono-caps text. */
    @media (max-width: 767px) {
      height: auto;
      min-width: 0;
      padding: 0;
      border: none;
      background: none;
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

import styled, { css } from "styled-components";

export type SheetCellAlign = "left" | "right";
export type SheetCellTone = "default" | "dim" | "positive" | "negative";

const toneColor = {
  default: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.ink,
  dim: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.dim,
  positive: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.positive,
  negative: ({ theme }: { theme: import("styled-components").DefaultTheme }) =>
    theme.colors.negative,
};

export const CellWrapper = styled.div<{
  $align: SheetCellAlign;
  $tone: SheetCellTone;
  $focused: boolean;
  $indent: number;
}>`
  ${({ theme }) => css`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border-right: 1px solid ${theme.colors.hairline};
    border-bottom: 1px solid ${theme.colors.hairline};
    background: ${theme.colors.canvas};
    display: flex;
    align-items: center;
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    min-width: 0;

    /* ~36px on desktop is below the touch floor; 12px vertical padding takes
       the row past 44px (DESIGN.md → Responsive Strategy → Touch Targets). */
    @media (max-width: 767px) {
      padding-top: ${theme.spacing.md};
      padding-bottom: ${theme.spacing.md};
    }
  `}

  &:last-child {
    border-right: none;
  }

  color: ${(props) => toneColor[props.$tone](props)};

  ${({ $align }) =>
    $align === "right" &&
    css`
      justify-content: flex-end;
      font-variant-numeric: tabular-nums;
    `}

  ${({ $focused, theme }) =>
    $focused &&
    css`
      outline: 2px solid ${theme.colors.focus};
      outline-offset: -2px;
      position: relative;
      z-index: 2;
      font-weight: 500;

      &::after {
        content: "";
        position: absolute;
        right: -4px;
        bottom: -4px;
        width: 7px;
        height: 7px;
        background: ${theme.colors.focus};
        border: 1px solid ${theme.colors.canvas};
      }
    `}

  ${({ $indent, theme }) =>
    $indent > 0 &&
    css`
      /* Depth 1 → 32, depth 2 → 48, depth 3 → 64. */
      padding-left: calc(
        ${theme.spacing["3xl"]} + ${theme.spacing.lg} * ${$indent - 1}
      );
    `}
`;

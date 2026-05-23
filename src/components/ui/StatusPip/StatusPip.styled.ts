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
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    line-height: 1;
  `}
`;

export const PipDot = styled.span<{ $state: StatusPipState }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => dotColor[props.$state](props)};
  flex-shrink: 0;
`;

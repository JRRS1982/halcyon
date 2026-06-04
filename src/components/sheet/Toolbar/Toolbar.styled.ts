import styled, { css } from "styled-components";

export const ToolbarWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.xs} 0 ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.hairline};
  `}
`;

export const ToolbarGroup = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.xs};
    padding-right: ${theme.spacing.md};
    border-right: 1px solid ${theme.colors.hairline};

    &:last-of-type {
      border-right: none;
    }

    /* Wrapped rows make the vertical group dividers read as clutter. */
    @media (max-width: 767px) {
      padding-right: 0;
      border-right: none;
    }
  `}
`;

export const ToolbarSpacer = styled.div`
  flex: 1;
`;

export const ToolbarTool = styled.button<{ $active?: boolean }>`
  ${({ theme, $active }) => css`
    height: 30px;
    padding: 0 ${theme.spacing.md};
    background: ${$active ? theme.colors.primary : theme.colors.canvas};
    color: ${$active ? theme.colors.onPrimary : theme.colors.ink};
    border: 1px solid ${$active ? theme.colors.primary : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    /* Mobile tap target (DESIGN.md: ≥44px on touch rows). */
    @media (max-width: 767px) {
      height: 44px;
    }

    &:hover:not(:disabled) {
      border-color: ${$active ? theme.colors.primary : theme.colors.ink};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}
`;

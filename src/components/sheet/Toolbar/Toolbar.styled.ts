import styled, { css } from "styled-components";

export const ToolbarWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.xs} 0 ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.hairline};
  `}
`;

export const ToolbarGroup = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.spacing.xs};
    padding-right: ${theme.spacing.md};
    border-right: 1px solid ${theme.colors.hairline};

    &:last-of-type {
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
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      border-color: ${$active ? theme.colors.primary : theme.colors.ink};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}
`;

// Period chip ("June 2026 ▾") sized to the longest month label so the
// prev/next arrows don't shift as the user navigates between months.
// 16ch covers "September 2026 ▾" in the mono face; 26px covers the chip's
// horizontal padding (2 × 12px) and borders.
export const ToolbarPeriodLabel = styled(ToolbarTool)`
  min-width: calc(16ch + 26px);
`;

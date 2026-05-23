import styled, { css } from "styled-components";

export const FormulaBarWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: stretch;
    background: ${theme.colors.canvasSoft};
    border-left: 1px solid ${theme.colors.hairline};
    border-right: 1px solid ${theme.colors.hairline};
    border-bottom: 1px solid ${theme.colors.hairline};
    height: 36px;
  `}
`;

export const FormulaBarRef = styled.div`
  ${({ theme }) => css`
    width: 80px;
    padding: 0 ${theme.spacing.md};
    display: flex;
    align-items: center;
    border-right: 1px solid ${theme.colors.hairline};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
  `}
`;

export const FormulaBarFx = styled.div`
  ${({ theme }) => css`
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${theme.colors.bodyMuted};
    font-style: italic;
    font-size: 14px;
    font-family: ${theme.typography.bodyMd.family};
    border-right: 1px solid ${theme.colors.hairline};
  `}
`;

export const FormulaBarValue = styled.div`
  ${({ theme }) => css`
    flex: 1;
    padding: 0 ${theme.spacing.md};
    display: flex;
    align-items: center;
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 14px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `}
`;

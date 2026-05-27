import styled, { css } from "styled-components";

// Shared 5-column template across every row in the sheet. Keep this in
// lockstep with DESIGN.md → Layout → Grid & Container → "Sheet column template".
export const SHEET_GRID = "1fr 150px 150px 150px 90px";

const baseRow = css`
  display: grid;
  grid-template-columns: ${SHEET_GRID};
`;

export const HeadRow = styled.div`
  ${baseRow}

  /* The cells inside a head row override default cell styling: smaller
     mono-caps labels on canvas-soft, stronger bottom hairline. */
  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.body};
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
`;

export const SectionRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasDark};
    color: ${({ theme }) => theme.colors.onDark};
    border-color: ${({ theme }) => theme.colors.hairlineDark};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    /* Label cell (1st) uses mono-caps. */
    &:nth-child(1) {
      font-family: ${({ theme }) => theme.typography.monoCaps.family};
      font-size: ${({ theme }) => theme.typography.monoCaps.size};
      font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
      text-transform: uppercase;
      letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    }
    /* Amount cells (2nd onwards) bump to medium weight. */
    &:nth-child(n + 2) {
      font-weight: 500;
    }
  }
`;

export const SubheadRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    color: ${({ theme }) => theme.colors.body};
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

export const ItemRow = styled.div`
  ${baseRow}
`;

export const TotalsRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    border-top: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    color: ${({ theme }) => theme.colors.body};
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

export const GrandRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
    border-color: ${({ theme }) => theme.colors.primary};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  }
  > div:nth-child(n + 2) {
    font-size: ${({ theme }) => theme.typography.amountXl.size};
    font-weight: ${({ theme }) => theme.typography.amountXl.weight};
    line-height: ${({ theme }) => theme.typography.amountXl.lineHeight};
    letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  }
`;

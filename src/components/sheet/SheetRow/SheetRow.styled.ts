import styled, { css } from "styled-components";

// Shared 3-column template across every row in the sheet (Category · Budget ·
// Actual). Keep this in lockstep with DESIGN.md → Layout → Grid & Container →
// "Sheet column template".
export const SHEET_GRID = "1fr 150px 150px";

const baseRow = css`
  display: grid;
  grid-template-columns: ${SHEET_GRID};
`;

export const HeadRow = styled.div`
  ${baseRow}

  /* Column-header cells: Inter, medium, dim, on canvas-soft with a stronger
     bottom hairline (unified single-font sheet — no mono-caps). */
  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.body};
    font-family: ${({ theme }) => theme.typography.bodyMd.family};
    font-size: ${({ theme }) => theme.typography.bodyMd.size};
    font-weight: 500;
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
`;

export const SectionRow = styled.div`
  ${baseRow}

  /* Section band (Income / Expenses): Inter semibold on the dark band. */
  > div {
    background: ${({ theme }) => theme.colors.canvasDark};
    color: ${({ theme }) => theme.colors.onDark};
    border-color: ${({ theme }) => theme.colors.hairlineDark};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    font-weight: 600;
  }
`;

export const SubheadRow = styled.div`
  ${baseRow}

  /* Sub-header (category buckets): Inter medium, label dim. */
  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  }
  > div:nth-child(1) {
    color: ${({ theme }) => theme.colors.body};
    font-weight: 500;
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

export const ItemRow = styled.div<{ $group?: boolean }>`
  ${baseRow}

  /* Group (parent) row: subtle tint + bold amount cells so the rolled-up
     figures read as totals, not editable entries. */
  ${({ $group, theme }) =>
    $group &&
    css`
      > div {
        background: ${theme.colors.canvasSoft};
      }
      > div:nth-child(n + 2) {
        font-weight: 500;
      }
    `}
`;

export const TotalsRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    border-top: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
  /* Subtotal: Inter semibold. */
  > div:nth-child(1) {
    color: ${({ theme }) => theme.colors.body};
    font-weight: 600;
  }
  > div:nth-child(n + 2) {
    font-weight: 600;
  }
`;

export const GrandRow = styled.div`
  ${baseRow}

  /* Grand total (Net income): same size as the section headings (Inter 14px),
     semibold — the dark band carries the emphasis, not an oversized type size. */
  > div {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
    border-color: ${({ theme }) => theme.colors.primary};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    font-weight: 600;
  }
`;

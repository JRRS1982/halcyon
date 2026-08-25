import styled, { css } from "styled-components";

// Shared 3-column template across every row in the sheet (Category · Budget ·
// Actual). Keep this in lockstep with DESIGN.md → Layout → Grid & Container →
// "Sheet column template".
export const SHEET_GRID = "1fr 150px 150px";

// Below desktop the amount columns narrow and the row keeps a floor width, so
// the sheet container (which turns into a horizontal scroller at the same
// breakpoints) pans instead of crushing the category column. The category cell
// stays pinned to the left edge while the amounts scroll under it.
// DESIGN.md → Responsive Strategy → Breakpoints / Collapsing Strategy.
const baseRow = css`
  display: grid;
  grid-template-columns: ${SHEET_GRID};

  @media (max-width: 991px) {
    grid-template-columns: minmax(200px, 1fr) 120px 120px;
    min-width: 440px;
  }

  /* A 360px phone leaves 328px inside the page's 16px mobile gutters, so the
     row floor sits at 320px — all three columns land on screen with nothing
     to pan to. Amounts keep tabular-nums room at 95px; see SheetCell for the
     matching drop in horizontal cell padding. */
  @media (max-width: 767px) {
    grid-template-columns: minmax(130px, 1fr) 95px 95px;
    min-width: 320px;
  }

  /* Each row variant already paints an opaque background on its cells, so the
     pinned category cell hides the amounts sliding beneath it. */
  @media (max-width: 991px) {
    > div:nth-child(1) {
      position: sticky;
      left: 0;
      z-index: 1;
    }
  }
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
    background: ${({ theme }) => theme.colors.band};
    color: ${({ theme }) => theme.colors.onBand};
    border-color: ${({ theme }) => theme.colors.hairlineBand};
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

import styled, { css } from "styled-components";

// Shared 6-column template across every row in the sheet (Category · Budget ·
// Actual · vs budget · Share of spend · Notes). Keep this in lockstep with DESIGN.md → Layout → Grid &
// Container → "Sheet column template".
export const SHEET_GRID =
  "minmax(180px, 1.2fr) 120px 120px 120px 150px minmax(160px, 1fr)";

// Below desktop the amount columns narrow and the row keeps a floor width, so
// the sheet container (which turns into a horizontal scroller at the same
// breakpoints) pans instead of crushing the category column. The category cell
// stays pinned to the left edge while the amounts scroll under it.
// DESIGN.md → Responsive Strategy → Breakpoints / Collapsing Strategy.
const baseRow = css`
  display: grid;
  grid-template-columns: ${SHEET_GRID};

  @media (max-width: 991px) {
    grid-template-columns: minmax(200px, 1fr) 110px 110px 110px 140px minmax(
        150px,
        1fr
      );
    min-width: 860px;
  }

  /* A 360px phone leaves 328px inside the page's 16px mobile gutters, so the
     row floor sits at 320px — all three columns land on screen with nothing
     to pan to. The insight columns and Notes are hidden to keep the sheet at
     three columns and within the viewport. Amounts keep tabular-nums room at 95px; see SheetCell for
     the matching drop in horizontal cell padding. */
  @media (max-width: 767px) {
    grid-template-columns: minmax(130px, 1fr) 95px 95px;
    min-width: 320px;
    > div:nth-child(n + 4) {
      display: none;
    }
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

// Cell treatments shared with the balance sheet, which lays its rows on its
// own three-column grid but sets them exactly as this one does.
export const sectionCells = css`
  /* Section heading (Income / Expenses): the serif, set like a page's
     section head, ruled off in ink beneath. */
  > div {
    color: ${({ theme }) => theme.colors.ink};
    font-family: ${({ theme }) => theme.typography.displayLg.family};
    font-size: ${({ theme }) => theme.typography.displayLg.size};
    font-weight: ${({ theme }) => theme.typography.displayLg.weight};
    border-bottom: 1px solid ${({ theme }) => theme.colors.ink};
    padding-top: ${({ theme }) => theme.spacing["2xl"]};
    padding-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

export const subheadCells = css`
  /* Sub-header (Fixed / Variable / …): serif, a step below the section. */
  > div {
    font-family: ${({ theme }) => theme.typography.displayLg.family};
    font-size: 16px;
    font-weight: 700;
    padding-top: ${({ theme }) => theme.spacing.md};
  }
  /* Its figures stay in the table's sans so the amount column reads as one. */
  > div:nth-child(n + 2) {
    font-family: ${({ theme }) => theme.typography.amountStrong.family};
    font-size: ${({ theme }) => theme.typography.amountStrong.size};
    font-weight: 600;
  }
`;

export const grandCells = css`
  /* Grand total ("Left over", "Net worth"): the bottom line, set in the serif
     at section size between two ink rules. */
  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.ink};
    font-family: ${({ theme }) => theme.typography.amountXl.family};
    font-size: ${({ theme }) => theme.typography.amountXl.size};
    font-weight: ${({ theme }) => theme.typography.amountXl.weight};
    border-top: 2px solid ${({ theme }) => theme.colors.ink};
    border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
  }
`;

/* Column heads as a market-data table sets them: small, muted, closed by a
   heavy ink rule. */
export const headCells = css`
  > div {
    color: ${({ theme }) => theme.colors.body};
    font-family: ${({ theme }) => theme.typography.bodyMd.family};
    font-size: 13px;
    font-weight: 600;
    border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
  }
`;

export const HeadRow = styled.div`
  ${baseRow}
  ${headCells}
`;

export const SectionRow = styled.div`
  ${baseRow}
  ${sectionCells}
`;

// $accent is the section's colour code, drawn as a bar against the label.
export const SubheadRow = styled.div<{ $accent?: string }>`
  ${baseRow}
  ${subheadCells}
  ${({ $accent, theme }) =>
    $accent &&
    css`
      > div:nth-child(1) {
        box-shadow: inset 4px 0 0 ${$accent};
        padding-left: ${theme.spacing.lg};
      }
    `}
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
    border-top: 1px solid ${({ theme }) => theme.colors.ink};
  }
  /* Subtotal: semibold. */
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
  ${grandCells}
`;

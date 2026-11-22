import styled, { css } from "styled-components";
import { visuallyHidden } from "@/lib/visuallyHidden";

// Shared 6-column template across every row in the sheet (Category · Budget ·
// Actual · vs budget · Share of spend · Notes). Keep this in lockstep with DESIGN.md → Layout → Grid &
// Container → "Sheet column template".
//
// The sheet owns the columns and each row is a subgrid of them, so a figure
// wider than its column's floor widens that column for every row rather than
// spilling over its neighbour. A fixed width per row could not: each row would
// size alone and the columns would stop lining up.
export const SHEET_GRID =
  "minmax(180px, 1.2fr) max-content max-content max-content max-content minmax(160px, 1fr)";

// The amount columns are max-content rather than minmax(floor, max-content):
// a minmax track gives back to its floor whenever the sheet is narrower than
// its columns, which is exactly when a figure needs the room. The floors are
// held by the cells instead, so a column is its floor or its widest figure,
// and a sheet too narrow for that pans.
// Below desktop the floors narrow and the category column keeps its own, so
// the sheet pans instead of crushing it; the category cell stays pinned to the
// left edge while the amounts scroll under it.
// DESIGN.md → Responsive Strategy → Breakpoints / Collapsing Strategy.
export const sheetGrid = css`
  --amount-floor: 120px;
  --share-floor: 150px;
  display: grid;
  grid-template-columns: ${SHEET_GRID};

  > [role="row"] > div:nth-child(n + 2):nth-child(-n + 4),
  > div > [role="row"] > div:nth-child(n + 2):nth-child(-n + 4) {
    min-width: var(--amount-floor);
  }
  > [role="row"] > div:nth-child(5),
  > div > [role="row"] > div:nth-child(5) {
    min-width: var(--share-floor);
  }

  @media (max-width: 991px) {
    --amount-floor: 110px;
    --share-floor: 140px;
    grid-template-columns:
      minmax(200px, 1fr) max-content max-content max-content max-content
      minmax(150px, 1fr);
  }

  /* A 360px phone leaves 328px inside the page's 16px mobile gutters, so the
     floor sits at 320px — all three columns land on screen with nothing to
     pan to unless a figure is wider than its 95px. The insight columns and
     Notes are hidden to keep the sheet at three columns. Amounts keep
     tabular-nums room at 95px; see SheetCell for the matching drop in
     horizontal cell padding. */
  @media (max-width: 767px) {
    --amount-floor: 95px;
    grid-template-columns: minmax(130px, 1fr) max-content max-content;
  }

  /* Wrappers that group a section's rows take no box of their own, so their
     rows still sit on the sheet's grid. */
  > div:not([role="row"]) {
    display: contents;
  }
`;

const baseRow = css`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;

  @media (max-width: 767px) {
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

// A column head kept for screen readers only.
export const HiddenHead = styled.span`
  ${visuallyHidden}
`;

export const HeadRow = styled.div`
  ${baseRow}
  ${headCells}
`;

export const SectionRow = styled.div`
  ${baseRow}
  ${sectionCells}
`;

// $accent is the section's colour code, drawn as a 4px bar against the label.
// Shared with the balance sheet's subheads.
export const subheadAccent = css<{ $accent?: string }>`
  ${({ $accent, theme }) =>
    $accent &&
    css`
      > div:nth-child(1) {
        box-shadow: inset 4px 0 0 ${$accent};
        padding-left: ${theme.spacing.lg};
      }
    `}
`;

export const SubheadRow = styled.div<{ $accent?: string }>`
  ${baseRow}
  ${subheadCells}
  ${subheadAccent}
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

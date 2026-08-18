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

// $rowScoped marks a group of tools that act on the focused row (delete,
// move, section pickers). On a phone those leave the resting toolbar and
// appear only while a row is focused ($engaged) — a permanently visible
// disabled button spends a whole toolbar row saying nothing. Desktop keeps
// every group visible.
export const ToolbarGroup = styled.div<{
  $rowScoped?: boolean;
  $engaged?: boolean;
}>`
  ${({ theme, $rowScoped, $engaged }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.xs};
    padding-right: ${theme.spacing.md};
    border-right: 1px solid ${theme.colors.hairline};

    &:last-of-type {
      border-right: none;
    }

    /* On a phone each resting group becomes one full-width row of evenly
       stretched controls — ragged flex-wrap (and the group dividers) read as
       clutter. Row-scoped groups instead pack together onto shared rows, so
       focusing a row costs as little sheet height as possible. */
    @media (max-width: 767px) {
      padding-right: 0;
      border-right: none;
      ${
        $rowScoped
          ? css`
            ${$engaged ? "" : "display: none;"}
            flex: 1 1 auto;
          `
          : "width: 100%;"
      }

      & > * {
        flex: 1;
      }

      /* Popover-anchor wrappers pass the stretch through to their button. */
      & > div {
        display: flex;
      }
      & > div > button {
        flex: 1;
      }
    }
  `}
`;

export const ToolbarSpacer = styled.div`
  flex: 1;
`;

// $danger marks the one control in a toolbar that destroys work. It stays a
// quiet outline button at rest — a row of red would be shouting, and the
// button spends most of its life disabled — and only commits to the colour on
// hover, at the moment the pointer is on it and the warning is still useful.
export const ToolbarTool = styled.button<{
  $active?: boolean;
  $danger?: boolean;
}>`
  ${({ theme, $active, $danger }) => css`
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

    /* Toolbar chips sit at 34px on a phone — shorter than the general ≥44px
       button rule (DESIGN.md → Buttons) because each control stretches to a
       full-width row share, so the horizontal hit area does the work. */
    @media (max-width: 767px) {
      height: 34px;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      border-color: ${
        $active
          ? theme.colors.primary
          : $danger
            ? theme.colors.negative
            : theme.colors.ink
      };
      color: ${
        $active
          ? theme.colors.onPrimary
          : $danger
            ? theme.colors.negative
            : theme.colors.ink
      };
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}
`;

// Toolbar <select> (category/section pickers). Same chrome and heights as
// ToolbarTool so a select never reads shorter than the buttons beside it.
export const ToolbarSelect = styled.select`
  ${({ theme }) => css`
    height: 30px;
    padding: 0 ${theme.spacing.sm};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    cursor: pointer;

    @media (max-width: 767px) {
      height: 34px;
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

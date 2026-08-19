import type { ReactNode } from "react";
import {
  CellWrapper,
  type SheetCellAlign,
  type SheetCellTone,
} from "./SheetCell.styled";

/**
 * `cell` for data, `columnheader` for the header strip, `rowheader` for the
 * label that names a row.
 *
 * The sheet is built from divs with `display: grid`, which strips whatever
 * table semantics the markup might otherwise have implied — so a screen reader
 * met an undifferentiated stream of numbers with nothing tying "1,200" to
 * "Rent" or to the "Budget" column. These roles restore that association.
 *
 * Deliberately `table` and not `grid`: `grid` promises arrow-key cell
 * navigation, and the sheet only moves focus on Enter (down a column). Better
 * to describe what it is than to claim an interaction that isn't there.
 *
 * Why roles rather than <table>/<tr>/<th>, which Biome's useSemanticElements
 * would prefer: the rows are laid out with CSS grid, and that is what gives
 * the sheet its shared column template, its full-width dark section bands and
 * its sticky-left category column below 992px. A browser drops the implicit
 * table semantics of any element it is told to display as a grid, so native
 * elements here would look identical and still expose nothing — these roles
 * would be needed regardless. The rule is switched off for the sheet in
 * biome.json for that reason, and stands everywhere else.
 */
export type SheetCellRole = "cell" | "columnheader" | "rowheader";

export type SheetCellProps = {
  align?: SheetCellAlign;
  tone?: SheetCellTone;
  focused?: boolean;
  indent?: number;
  role?: SheetCellRole;
  // Native tooltip, for cells whose tone needs a why (e.g. carried-over
  // balance values).
  title?: string;
  children?: ReactNode;
};

export function SheetCell({
  align = "left",
  tone = "default",
  focused = false,
  indent = 0,
  role = "cell",
  title,
  children,
}: SheetCellProps) {
  return (
    <CellWrapper
      role={role}
      title={title}
      $align={align}
      $tone={tone}
      $focused={focused}
      $indent={indent}
    >
      {children}
    </CellWrapper>
  );
}

export type { SheetCellAlign, SheetCellTone };

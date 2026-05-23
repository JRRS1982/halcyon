import type { ReactNode } from "react";
import {
  CellWrapper,
  type SheetCellAlign,
  type SheetCellTone,
} from "./SheetCell.styled";

export type SheetCellProps = {
  align?: SheetCellAlign;
  tone?: SheetCellTone;
  focused?: boolean;
  indent?: number;
  children?: ReactNode;
};

export function SheetCell({
  align = "left",
  tone = "default",
  focused = false,
  indent = 0,
  children,
}: SheetCellProps) {
  return (
    <CellWrapper
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

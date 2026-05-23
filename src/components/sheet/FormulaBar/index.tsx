import type { ReactNode } from "react";
import {
  FormulaBarFx,
  FormulaBarRef,
  FormulaBarValue,
  FormulaBarWrapper,
} from "./FormulaBar.styled";

export type FormulaBarProps = {
  cellRef?: string;
  value?: ReactNode;
};

// Read-only in v1: shows the cellRef of the focused cell and its raw value.
// No expression evaluation; "=4500 + 3000" would render as literal text.
export function FormulaBar({ cellRef = "", value = "" }: FormulaBarProps) {
  return (
    <FormulaBarWrapper>
      <FormulaBarRef>{cellRef}</FormulaBarRef>
      <FormulaBarFx>fx</FormulaBarFx>
      <FormulaBarValue>{value}</FormulaBarValue>
    </FormulaBarWrapper>
  );
}

import type { ReactNode } from "react";
import { SheetCell } from "../SheetCell";
import {
  GrandRow,
  HeadRow,
  ItemRow,
  SectionRow,
  SubheadRow,
  TotalsRow,
} from "./SheetRow.styled";

// Column header row — Category · Budget · Actual.
export function SheetHeadRow() {
  return (
    <HeadRow role="row">
      <SheetCell role="columnheader">Category</SheetCell>
      <SheetCell role="columnheader" align="right">
        Budget
      </SheetCell>
      <SheetCell role="columnheader" align="right">
        Actual
      </SheetCell>
    </HeadRow>
  );
}

type AmountCells = {
  budget: ReactNode;
  actual: ReactNode;
};

// Section group header (Income, Expenses). Dark full-width band.
export function SheetSectionRow({
  label,
  amounts,
}: {
  label: ReactNode;
  amounts: AmountCells;
}) {
  return (
    <SectionRow role="row">
      <SheetCell role="rowheader">{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
    </SectionRow>
  );
}

// Sub-section header sitting between a section and its items (e.g. expense
// category buckets). Softer than SheetSectionRow so the hierarchy reads
// Section > Subhead > Item.
export function SheetSubheadRow({
  label,
  amounts,
}: {
  label: ReactNode;
  amounts: AmountCells;
}) {
  return (
    <SubheadRow role="row">
      <SheetCell role="rowheader">{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
    </SubheadRow>
  );
}

// Default line-item row. Depth controls label indent (1, 2, or 3).
// Each amount slot is a ReactNode so the caller can wrap in tone/focused
// state at the cell level if needed. `variant="group"` tints the row and
// bolds its amounts to mark a parent whose figures are a roll-up of its
// children rather than directly-editable values.
export function SheetItemRow({
  depth,
  label,
  amounts,
  focusedCell,
  onSelect,
  variant = "default",
}: {
  depth: 1 | 2 | 3;
  label: ReactNode;
  amounts: {
    budget: {
      value: ReactNode;
      tone?: "default" | "dim" | "positive" | "negative";
    };
    actual: {
      value: ReactNode;
      tone?: "default" | "dim" | "positive" | "negative";
    };
  };
  focusedCell?: "label" | "budget" | "actual";
  // Fires on mousedown on any part of the row. Inputs' onFocus will fire
  // afterwards and override the focused cell to the specific field — so this
  // only "selects" the row when the user clicked outside any input.
  onSelect?: () => void;
  variant?: "default" | "group";
}) {
  return (
    <ItemRow role="row" onMouseDown={onSelect} $group={variant === "group"}>
      <SheetCell
        role="rowheader"
        indent={depth}
        focused={focusedCell === "label"}
      >
        {label}
      </SheetCell>
      <SheetCell
        align="right"
        tone={amounts.budget.tone ?? "default"}
        focused={focusedCell === "budget"}
      >
        {amounts.budget.value}
      </SheetCell>
      <SheetCell
        align="right"
        tone={amounts.actual.tone ?? "default"}
        focused={focusedCell === "actual"}
      >
        {amounts.actual.value}
      </SheetCell>
    </ItemRow>
  );
}

// Section subtotal row.
export function SheetTotalsRow({
  label,
  amounts,
}: {
  label: ReactNode;
  amounts: AmountCells;
}) {
  return (
    <TotalsRow role="row">
      <SheetCell role="rowheader">{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
    </TotalsRow>
  );
}

// Grand total row (the budget sheet's "Left over", the balance sheet's
// "Net worth"). Black band.
export function SheetGrandRow({
  label,
  amounts,
}: {
  label: ReactNode;
  amounts: AmountCells;
}) {
  return (
    <GrandRow role="row">
      <SheetCell role="rowheader">{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
    </GrandRow>
  );
}

import type { ReactNode } from "react";
import { SheetCell } from "../SheetCell";
import {
  GrandRow,
  HeadRow,
  ItemRow,
  SectionRow,
  TotalsRow,
} from "./SheetRow.styled";

// Column header row — Category · Budget · Actual · Variance · %.
export function SheetHeadRow() {
  return (
    <HeadRow>
      <SheetCell>Category</SheetCell>
      <SheetCell align="right">Budget</SheetCell>
      <SheetCell align="right">Actual</SheetCell>
      <SheetCell align="right">Variance</SheetCell>
      <SheetCell align="right">%</SheetCell>
    </HeadRow>
  );
}

type AmountCells = {
  budget: ReactNode;
  actual: ReactNode;
  variance: ReactNode;
  variancePct: ReactNode;
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
    <SectionRow>
      <SheetCell>{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
      <SheetCell align="right">{amounts.variance}</SheetCell>
      <SheetCell align="right">{amounts.variancePct}</SheetCell>
    </SectionRow>
  );
}

// Default line-item row. Depth controls label indent (1, 2, or 3).
// Each amount slot is a ReactNode so the caller can wrap in tone/focused
// state at the cell level if needed.
export function SheetItemRow({
  depth,
  label,
  amounts,
  focusedCell,
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
    variance: {
      value: ReactNode;
      tone?: "default" | "dim" | "positive" | "negative";
    };
    variancePct: {
      value: ReactNode;
      tone?: "default" | "dim" | "positive" | "negative";
    };
  };
  focusedCell?: "label" | "budget" | "actual";
}) {
  return (
    <ItemRow>
      <SheetCell indent={depth} focused={focusedCell === "label"}>
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
      <SheetCell align="right" tone={amounts.variance.tone ?? "default"}>
        {amounts.variance.value}
      </SheetCell>
      <SheetCell align="right" tone={amounts.variancePct.tone ?? "default"}>
        {amounts.variancePct.value}
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
    <TotalsRow>
      <SheetCell>{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
      <SheetCell align="right">{amounts.variance}</SheetCell>
      <SheetCell align="right">{amounts.variancePct}</SheetCell>
    </TotalsRow>
  );
}

// Grand total row (Net income). Black band.
export function SheetGrandRow({
  label,
  amounts,
}: {
  label: ReactNode;
  amounts: AmountCells;
}) {
  return (
    <GrandRow>
      <SheetCell>{label}</SheetCell>
      <SheetCell align="right">{amounts.budget}</SheetCell>
      <SheetCell align="right">{amounts.actual}</SheetCell>
      <SheetCell align="right">{amounts.variance}</SheetCell>
      <SheetCell align="right">{amounts.variancePct}</SheetCell>
    </GrandRow>
  );
}

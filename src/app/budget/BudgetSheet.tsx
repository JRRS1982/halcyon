"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import styled from "styled-components";
import { FormulaBar } from "@/components/sheet/FormulaBar";
import { Sheet } from "@/components/sheet/Sheet";
import {
  SheetGrandRow,
  SheetHeadRow,
  SheetItemRow,
  SheetSectionRow,
  SheetTotalsRow,
} from "@/components/sheet/SheetRow";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSpacer,
  ToolbarTool,
} from "@/components/sheet/Toolbar";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPip, type StatusPipState } from "@/components/ui/StatusPip";
import {
  computeRollups,
  grandTotals,
  sectionTotals,
} from "@/lib/budget/totals";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { createItem, updateItem } from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SerializedPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type SerializedItem = {
  id: string;
  type: "INCOME" | "EXPENSE";
  parentItemId: string | null;
  label: string;
  budget: number;
  actual: number;
  sortOrder: number;
};

type FocusedCell = {
  itemId: string;
  field: "label" | "budget" | "actual";
} | null;

// ─── Formatting helpers ─────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatSigned = (n: number) => {
  if (n === 0) return "$0.00";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n > 0 ? `+$${abs}` : `−$${abs}`;
};

const formatPct = (n: number) => `${n}%`;

const toneFor = (n: number) => {
  if (n === 0) return "dim" as const;
  return n > 0 ? "positive" as const : "negative" as const;
};

// ─── Styled in-cell inputs ──────────────────────────────────────────────────

const CellInput = styled.input<{ $align?: "left" | "right" }>`
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: ${({ $align }) => $align ?? "left"};
  font-variant-numeric: ${({ $align }) =>
    $align === "right" ? "tabular-nums" : "normal"};

  &::placeholder {
    color: ${({ theme }) => theme.colors.dim};
  }
`;

const PageShell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

// Walk top-level → children → grandchildren etc, sorted by sortOrder at each
// level. Returns the flat render order plus each item's depth (1..3).
function buildSectionOrder(
  items: SerializedItem[],
  type: "INCOME" | "EXPENSE",
): { item: SerializedItem; depth: 1 | 2 | 3 }[] {
  const childrenByParent = new Map<string | null, SerializedItem[]>();
  for (const item of items.filter((i) => i.type === type)) {
    const key = item.parentItemId;
    const list = childrenByParent.get(key) ?? [];
    list.push(item);
    childrenByParent.set(key, list);
  }
  childrenByParent.forEach((list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  });
  const result: { item: SerializedItem; depth: 1 | 2 | 3 }[] = [];
  function walk(parentId: string | null, depth: 1 | 2 | 3) {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      result.push({ item: child, depth });
      if (depth < 3) {
        walk(child.id, (depth + 1) as 1 | 2 | 3);
      }
    }
  }
  walk(null, 1);
  return result;
}

const formatRelative = (then: Date | null, now: Date): string => {
  if (!then) return "";
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function BudgetSheet({
  period,
  initialItems,
}: {
  period: SerializedPeriod;
  initialItems: SerializedItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);
  const pendingSavesRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());

  // Tick the "Saved Xs ago" pip every 5s.
  useMemo(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // ─── Save plumbing ────────────────────────────────────────────────────────

  const performUpdate = useCallback(
    async (itemId: string, patch: { label?: string; budget?: number; actual?: number }) => {
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      try {
        await updateItem({ itemId, ...patch });
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed");
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    },
    [],
  );

  const debouncedUpdate = useDebouncedCallback(performUpdate, 500);

  // Optimistic patch + debounced save.
  const editField = useCallback(
    (itemId: string, patch: { label?: string; budget?: number; actual?: number }) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      );
      debouncedUpdate(itemId, patch);
    },
    [debouncedUpdate],
  );

  const onAddRow = useCallback(
    (type: "INCOME" | "EXPENSE") => {
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          const created = await createItem({
            periodId: period.id,
            type,
            parentItemId: null,
            label: "New row",
          });
          setItems((prev) => [
            ...prev,
            {
              id: created.id,
              type: created.type,
              parentItemId: created.parentItemId,
              label: created.label,
              budget: Number(created.budget),
              actual: Number(created.actual),
              sortOrder: created.sortOrder,
            },
          ]);
          setLastSavedAt(new Date());
          setSaveError(null);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : "Add row failed");
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingCount(pendingSavesRef.current);
        }
      });
    },
    [period.id],
  );

  // ─── Derived data ─────────────────────────────────────────────────────────

  const incomeRows = useMemo(() => buildSectionOrder(items, "INCOME"), [items]);
  const expenseRows = useMemo(() => buildSectionOrder(items, "EXPENSE"), [items]);

  const rollups = useMemo(() => computeRollups(items), [items]);
  const incomeTotals = useMemo(
    () => sectionTotals(items, "INCOME", rollups),
    [items, rollups],
  );
  const expenseTotals = useMemo(
    () => sectionTotals(items, "EXPENSE", rollups),
    [items, rollups],
  );
  const grand = useMemo(
    () => grandTotals(incomeTotals, expenseTotals),
    [incomeTotals, expenseTotals],
  );

  // ─── Status pip state ─────────────────────────────────────────────────────

  const pipState: StatusPipState = saveError
    ? "error"
    : pendingCount > 0
      ? "saving"
      : "saved";
  const pipText = saveError
    ? `Failed — ${saveError}`
    : pendingCount > 0
      ? "Saving…"
      : lastSavedAt
        ? `Saved ${formatRelative(lastSavedAt, now)}`
        : "Up to date";

  // ─── Formula bar info ─────────────────────────────────────────────────────

  // Cell ref like "B3" — column letter (B=label, C=budget, D=actual) +
  // 1-indexed row position within the flat render. Simple v1 mapping.
  const allRowsInOrder = useMemo(
    () => [...incomeRows, ...expenseRows].map(({ item }) => item.id),
    [incomeRows, expenseRows],
  );

  const cellRef = useMemo(() => {
    if (!focusedCell) return "";
    const rowIdx = allRowsInOrder.indexOf(focusedCell.itemId);
    if (rowIdx < 0) return "";
    const col =
      focusedCell.field === "label"
        ? "B"
        : focusedCell.field === "budget"
          ? "C"
          : "D";
    return `${col}${rowIdx + 1}`;
  }, [focusedCell, allRowsInOrder]);

  const cellValue = useMemo(() => {
    if (!focusedCell) return "";
    const item = items.find((i) => i.id === focusedCell.itemId);
    if (!item) return "";
    if (focusedCell.field === "label") return item.label;
    if (focusedCell.field === "budget") return formatCurrency(item.budget);
    return formatCurrency(item.actual);
  }, [focusedCell, items]);

  // ─── Render ───────────────────────────────────────────────────────────────

  let rowCounter = 0;
  const nextRow = () => {
    rowCounter += 1;
    return rowCounter;
  };

  const renderItemRow = (item: SerializedItem, depth: 1 | 2 | 3) => {
    const rollup = rollups.get(item.id) ?? { budget: 0, actual: 0 };
    const variance = item.type === "INCOME"
      ? rollup.actual - rollup.budget
      : rollup.budget - rollup.actual;
    const pct = rollup.budget === 0
      ? 0
      : Math.round((rollup.actual / rollup.budget) * 100);

    return (
      <SheetItemRow
        key={item.id}
        index={nextRow()}
        depth={depth}
        label={
          <CellInput
            value={item.label}
            onChange={(e) => editField(item.id, { label: e.target.value })}
            onFocus={() => setFocusedCell({ itemId: item.id, field: "label" })}
          />
        }
        amounts={{
          budget: {
            value: (
              <CellInput
                $align="right"
                value={item.budget === 0 ? "" : item.budget.toFixed(2)}
                placeholder="0.00"
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  editField(item.id, { budget: Number.isNaN(v) ? 0 : v });
                }}
                onFocus={() =>
                  setFocusedCell({ itemId: item.id, field: "budget" })
                }
              />
            ),
            tone: item.budget === 0 ? "dim" : "default",
          },
          actual: {
            value: (
              <CellInput
                $align="right"
                value={item.actual === 0 ? "" : item.actual.toFixed(2)}
                placeholder="0.00"
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  editField(item.id, { actual: Number.isNaN(v) ? 0 : v });
                }}
                onFocus={() =>
                  setFocusedCell({ itemId: item.id, field: "actual" })
                }
              />
            ),
            tone: item.actual === 0 ? "dim" : "default",
          },
          variance: {
            value: formatSigned(variance),
            tone: toneFor(variance),
          },
          variancePct: {
            value: formatPct(pct),
            tone: pct === 0 ? "dim" : "default",
          },
        }}
        focusedCell={
          focusedCell?.itemId === item.id ? focusedCell.field : undefined
        }
      />
    );
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Budget · ${period.label}`}
        title="Budget overview"
        lead="Click any cell to edit. Tab moves right, Enter drops down. Totals recalc as you type."
        actions={
          <>
            <StatusPip state={pipState}>{pipText}</StatusPip>
          </>
        }
      />

      <Toolbar>
        <ToolbarGroup>
          <ToolbarTool disabled>{period.label}</ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={() => onAddRow("INCOME")}>
            + Add income row
          </ToolbarTool>
          <ToolbarTool onClick={() => onAddRow("EXPENSE")}>
            + Add expense row
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool $active>$ USD</ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
      </Toolbar>

      <FormulaBar cellRef={cellRef} value={cellValue} />

      <Sheet>
        <SheetHeadRow />

        <SheetSectionRow
          index={nextRow()}
          label="Income"
          amounts={{
            budget: formatCurrency(incomeTotals.budget),
            actual: formatCurrency(incomeTotals.actual),
            variance: formatSigned(incomeTotals.variance),
            variancePct: formatPct(incomeTotals.variancePct),
          }}
        />
        {incomeRows.map(({ item, depth }) => renderItemRow(item, depth))}
        <SheetTotalsRow
          index={nextRow()}
          label="Income subtotal"
          amounts={{
            budget: formatCurrency(incomeTotals.budget),
            actual: formatCurrency(incomeTotals.actual),
            variance: formatSigned(incomeTotals.variance),
            variancePct: formatPct(incomeTotals.variancePct),
          }}
        />

        <SheetSectionRow
          index={nextRow()}
          label="Expenses"
          amounts={{
            budget: formatCurrency(expenseTotals.budget),
            actual: formatCurrency(expenseTotals.actual),
            variance: formatSigned(expenseTotals.variance),
            variancePct: formatPct(expenseTotals.variancePct),
          }}
        />
        {expenseRows.map(({ item, depth }) => renderItemRow(item, depth))}
        <SheetTotalsRow
          index={nextRow()}
          label="Expenses subtotal"
          amounts={{
            budget: formatCurrency(expenseTotals.budget),
            actual: formatCurrency(expenseTotals.actual),
            variance: formatSigned(expenseTotals.variance),
            variancePct: formatPct(expenseTotals.variancePct),
          }}
        />

        <SheetGrandRow
          index={nextRow()}
          label="Net income"
          amounts={{
            budget: formatSigned(grand.budget),
            actual: formatSigned(grand.actual),
            variance: formatSigned(grand.variance),
            variancePct: "",
          }}
        />
      </Sheet>
    </PageShell>
  );
}

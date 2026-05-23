"use client";

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
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPip, type StatusPipState } from "@/components/ui/StatusPip";
import {
  computeRollups,
  grandTotals,
  sectionTotals,
} from "@/lib/budget/totals";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styled from "styled-components";
import { createItem, deleteItem, reparentItem, updateItem } from "./actions";

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
  return n > 0 ? ("positive" as const) : ("negative" as const);
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

// Accent-coloured period date in the page eyebrow. Bold + blue — the single
// orientation moment on the page per DESIGN.md → Do's.
const PeriodLabel = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
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
  for (const list of Array.from(childrenByParent.values())) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
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

// Depth of `itemId` walking up the parent chain (top-level = 1).
function computeItemDepth(items: SerializedItem[], itemId: string): number {
  const byId = new Map(items.map((i) => [i.id, i]));
  let depth = 1;
  let current = byId.get(itemId);
  while (current && current.parentItemId !== null) {
    depth++;
    current = byId.get(current.parentItemId);
  }
  return depth;
}

// Depth of the deepest descendant below `rootId` (rootId itself = 0).
function computeSubtreeDepth(items: SerializedItem[], rootId: string): number {
  const childrenByParent = new Map<string, SerializedItem[]>();
  for (const item of items) {
    if (item.parentItemId === null) continue;
    const list = childrenByParent.get(item.parentItemId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentItemId, list);
  }
  function rec(id: string): number {
    const children = childrenByParent.get(id) ?? [];
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map((c) => rec(c.id)));
  }
  return rec(rootId);
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

  // When a row is just added, we want the user to land in its label input
  // immediately — both so they can rename "New row" without an extra click and
  // so the toolbar's Indent/Outdent buttons enable (they key off focusedCell).
  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(
    null,
  );
  const labelInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!pendingFocusItemId) return;
    // The new row's input has just mounted in the same batch as
    // setPendingFocusItemId, so the ref should be populated by now.
    const input = labelInputRefs.current.get(pendingFocusItemId);
    if (input) {
      input.focus();
      input.select();
      setPendingFocusItemId(null);
    }
  }, [pendingFocusItemId]);

  // Tick the "Saved Xs ago" pip every 5s.
  useMemo(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // ─── Save plumbing ────────────────────────────────────────────────────────

  const performUpdate = useCallback(
    async (
      itemId: string,
      patch: { label?: string; budget?: number; actual?: number },
    ) => {
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
    (
      itemId: string,
      patch: { label?: string; budget?: number; actual?: number },
    ) => {
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
          // Focus the new row's label input so the user can rename it
          // immediately and so Indent/Outdent become available.
          setFocusedCell({ itemId: created.id, field: "label" });
          setPendingFocusItemId(created.id);
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
  const expenseRows = useMemo(
    () => buildSectionOrder(items, "EXPENSE"),
    [items],
  );

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

  // ─── Indent / outdent ─────────────────────────────────────────────────────

  const focusedItem = useMemo(
    () =>
      focusedCell
        ? (items.find((i) => i.id === focusedCell.itemId) ?? null)
        : null,
    [focusedCell, items],
  );

  // Indent is allowed when the focused row has a preceding sibling at the
  // same depth/parent AND the move doesn't push the subtree past depth 3.
  const indentTarget = useMemo(() => {
    if (!focusedItem) return null;
    const siblings = items
      .filter(
        (i) =>
          i.type === focusedItem.type &&
          i.parentItemId === focusedItem.parentItemId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex((i) => i.id === focusedItem.id);
    if (idx <= 0) return null;
    const predecessor = siblings[idx - 1];
    const predDepth = computeItemDepth(items, predecessor.id);
    const subtreeDepth = computeSubtreeDepth(items, focusedItem.id);
    if (predDepth + 1 + subtreeDepth > 3) return null;
    return predecessor;
  }, [focusedItem, items]);

  const canIndent = indentTarget !== null;
  const canOutdent = focusedItem !== null && focusedItem.parentItemId !== null;

  const performReparent = useCallback(
    async (itemId: string, newParentItemId: string | null) => {
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      try {
        const updated = await reparentItem({ itemId, newParentItemId });
        setItems((prev) =>
          prev.map((it) =>
            it.id === updated.id
              ? {
                  ...it,
                  parentItemId: updated.parentItemId,
                  sortOrder: updated.sortOrder,
                }
              : it,
          ),
        );
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Move failed");
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    },
    [],
  );

  const onIndent = useCallback(() => {
    if (!focusedItem || !indentTarget) return;
    void performReparent(focusedItem.id, indentTarget.id);
  }, [focusedItem, indentTarget, performReparent]);

  const onOutdent = useCallback(() => {
    if (!focusedItem || !focusedItem.parentItemId) return;
    const parent = items.find((i) => i.id === focusedItem.parentItemId);
    if (!parent) return;
    void performReparent(focusedItem.id, parent.parentItemId);
  }, [focusedItem, items, performReparent]);

  // ─── Delete ───────────────────────────────────────────────────────────────

  const onDelete = useCallback(() => {
    if (!focusedItem) return;
    const target = focusedItem;

    // Find every descendant of the focused row — they go with the parent.
    const toDelete = new Set<string>([target.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of items) {
        if (
          item.parentItemId &&
          toDelete.has(item.parentItemId) &&
          !toDelete.has(item.id)
        ) {
          toDelete.add(item.id);
          grew = true;
        }
      }
    }

    // Optimistic — drop the row(s) from local state immediately, clear focus.
    setItems((prev) => prev.filter((it) => !toDelete.has(it.id)));
    setFocusedCell(null);

    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    void (async () => {
      try {
        await deleteItem({ itemId: target.id });
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    })();
  }, [focusedItem, items]);

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

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderItemRow = (item: SerializedItem, depth: 1 | 2 | 3) => {
    const rollup = rollups.get(item.id) ?? { budget: 0, actual: 0 };
    const variance =
      item.type === "INCOME"
        ? rollup.actual - rollup.budget
        : rollup.budget - rollup.actual;
    const pct =
      rollup.budget === 0
        ? 0
        : Math.round((rollup.actual / rollup.budget) * 100);

    return (
      <SheetItemRow
        key={item.id}
        depth={depth}
        onSelect={() => setFocusedCell({ itemId: item.id, field: "label" })}
        label={
          <CellInput
            ref={(el) => {
              if (el) labelInputRefs.current.set(item.id, el);
              else labelInputRefs.current.delete(item.id);
            }}
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
        eyebrow={
          <>
            Budget · <PeriodLabel>{period.label}</PeriodLabel>
          </>
        }
        title="Budget overview"
        lead="Click any cell to edit. Tab moves right, Enter drops down. Totals recalc as you type."
        actions={<StatusPip state={pipState}>{pipText}</StatusPip>}
      />

      <Toolbar>
        <ToolbarGroup>
          <ToolbarTool onClick={() => onAddRow("INCOME")}>
            + Add income row
          </ToolbarTool>
          <ToolbarTool onClick={() => onAddRow("EXPENSE")}>
            + Add expense row
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={onOutdent} disabled={!canOutdent}>
            ← Outdent
          </ToolbarTool>
          <ToolbarTool onClick={onIndent} disabled={!canIndent}>
            → Indent
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={onDelete} disabled={!focusedItem}>
            × Delete row
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
      </Toolbar>

      <Sheet>
        <SheetHeadRow />

        <SheetSectionRow
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
          label="Income subtotal"
          amounts={{
            budget: formatCurrency(incomeTotals.budget),
            actual: formatCurrency(incomeTotals.actual),
            variance: formatSigned(incomeTotals.variance),
            variancePct: formatPct(incomeTotals.variancePct),
          }}
        />

        <SheetSectionRow
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
          label="Expenses subtotal"
          amounts={{
            budget: formatCurrency(expenseTotals.budget),
            actual: formatCurrency(expenseTotals.actual),
            variance: formatSigned(expenseTotals.variance),
            variancePct: formatPct(expenseTotals.variancePct),
          }}
        />

        <SheetGrandRow
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

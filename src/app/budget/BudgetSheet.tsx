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
  MONTH_LABELS_SHORT,
  formatYm,
  nextMonth,
  previousMonth,
} from "@/lib/budget/period";
import {
  computeRollups,
  grandTotals,
  sectionTotals,
} from "@/lib/budget/totals";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styled from "styled-components";
import {
  createItem,
  deleteItem,
  ensurePeriodForMonth,
  reparentItem,
  updateItem,
} from "./actions";

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

// Period nav: wraps the prev/label/next triplet so the picker popover can
// position itself absolutely relative to the label button.
const PeriodNavWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const PickerPopover = styled.div`
  ${({ theme }) => `
    position: absolute;
    top: calc(100% + ${theme.spacing.xs});
    left: 0;
    z-index: 10;
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    box-shadow: rgba(15, 17, 22, 0.08) 0px 4px 12px 0px;
    padding: ${theme.spacing.md};
    min-width: 280px;
  `}
`;

const PickerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const PickerYearLabel = styled.span`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: ${theme.typography.bodyMdStrong.size};
    font-weight: ${theme.typography.bodyMdStrong.weight};
    color: ${theme.colors.ink};
    font-variant-numeric: tabular-nums;
  `}
`;

const PickerYearButton = styled.button`
  ${({ theme }) => `
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: ${theme.colors.ink};
    font-size: 11px;

    &:hover {
      border-color: ${theme.colors.ink};
    }
  `}
`;

const PickerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
`;

const PickerMonth = styled.button<{ $current?: boolean }>`
  ${({ theme, $current }) => `
    background: ${$current ? theme.colors.primary : theme.colors.canvas};
    color: ${$current ? theme.colors.onPrimary : theme.colors.ink};
    border: 1px solid ${$current ? theme.colors.primary : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    padding: ${theme.spacing.sm} 0;
    cursor: pointer;
    transition: border-color 100ms;

    &:hover:not(:disabled) {
      border-color: ${theme.colors.ink};
    }
  `}
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
  year,
  month,
}: {
  period: SerializedPeriod;
  initialItems: SerializedItem[];
  year: number;
  month: number;
}) {
  // year and month come from the URL ?ym=YYYY-MM (resolved server-side).
  // They drive the period nav UI and onAddRow's lazy create.
  const periodYear = year;
  const periodMonth = month;
  // periodState carries the period's DB id once it's been materialised.
  // A virtual period (no row in DB yet) starts with id="". The first
  // onAddRow call ensures the DB row exists and flips id to the real uuid.
  const [periodState, setPeriodState] = useState(period);
  const [items, setItems] = useState(initialItems);
  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);
  const pendingSavesRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());

  // ─── Period navigation state ──────────────────────────────────────────────

  const router = useRouter();

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, []);
  const isOnCurrentMonth =
    periodYear === today.year && periodMonth === today.month;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(periodYear);
  const pickerWrapperRef = useRef<HTMLDivElement | null>(null);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        pickerWrapperRef.current &&
        !pickerWrapperRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [pickerOpen]);

  // Navigation is pure URL push — no server work, no DB write. The new
  // page render fetches the period (or renders virtual). The period only
  // becomes a DB row when the user adds an item to it (see onAddRow).
  const navigateToMonth = useCallback(
    (targetYear: number, targetMonth: number) => {
      setPickerOpen(false);
      startTransition(() => {
        router.push(`/budget?ym=${formatYm(targetYear, targetMonth)}`);
        router.refresh();
      });
    },
    [router],
  );

  const onPrevMonth = useCallback(() => {
    const d = new Date(Date.UTC(year, month, 1));
    const { year: y, month: m } = previousMonth(d);
    navigateToMonth(y, m);
  }, [year, month, navigateToMonth]);

  const onNextMonth = useCallback(() => {
    const d = new Date(Date.UTC(year, month, 1));
    const { year: y, month: m } = nextMonth(d);
    navigateToMonth(y, m);
  }, [year, month, navigateToMonth]);

  const onToday = useCallback(() => {
    navigateToMonth(today.year, today.month);
  }, [today, navigateToMonth]);

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
          // Lazy: if the period doesn't have a DB row yet (virtual), create
          // it now. Once it has an id, subsequent adds reuse that id.
          let pid = periodState.id;
          if (!pid) {
            const real = await ensurePeriodForMonth(year, month);
            pid = real.id;
            setPeriodState((prev) => ({ ...prev, id: real.id }));
          }
          const created = await createItem({
            periodId: pid,
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
    [periodState.id, year, month],
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

  // Indent makes the row immediately above the focused row (in render order,
  // within the same section) the new parent. Disabled when:
  //   - nothing is focused
  //   - focused row is the first row in its section (nothing above)
  //   - the row above is already this row's parent (no-op)
  //   - the move would push the focused row's subtree past depth 3
  const indentTarget = useMemo(() => {
    if (!focusedItem) return null;
    const renderOrder = buildSectionOrder(items, focusedItem.type);
    const idx = renderOrder.findIndex(({ item }) => item.id === focusedItem.id);
    if (idx <= 0) return null;
    const above = renderOrder[idx - 1].item;
    if (above.id === focusedItem.parentItemId) return null;
    const aboveDepth = computeItemDepth(items, above.id);
    const subtreeDepth = computeSubtreeDepth(items, focusedItem.id);
    if (aboveDepth + 1 + subtreeDepth > 3) return null;
    return above;
  }, [focusedItem, items]);

  const canIndent = indentTarget !== null;
  const canOutdent = focusedItem !== null && focusedItem.parentItemId !== null;

  const performReparent = useCallback(
    async (itemId: string, newParentItemId: string | null) => {
      // Snapshot the row's previous parent+sortOrder so we can revert the
      // optimistic update if the server rejects (cycle, depth cap, ownership).
      const target = items.find((it) => it.id === itemId);
      if (!target) return;
      const previousState = {
        parentItemId: target.parentItemId,
        sortOrder: target.sortOrder,
      };

      // Optimistic — change parentItemId locally so the indent shows up
      // instantly without waiting on the round-trip.
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, parentItemId: newParentItemId } : it,
        ),
      );

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
        // Revert so the UI matches the server.
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  parentItemId: previousState.parentItemId,
                  sortOrder: previousState.sortOrder,
                }
              : it,
          ),
        );
        setSaveError(e instanceof Error ? e.message : "Move failed");
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    },
    [items],
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
            Budget · <PeriodLabel>{periodState.label}</PeriodLabel>
          </>
        }
        title="Budget overview"
        lead="Click any cell to edit. Tab moves right, Enter drops down. Totals recalc as you type."
        actions={<StatusPip state={pipState}>{pipText}</StatusPip>}
      />

      <Toolbar>
        <ToolbarGroup>
          <PeriodNavWrapper ref={pickerWrapperRef}>
            <ToolbarTool onClick={onPrevMonth} aria-label="Previous month">
              ◀
            </ToolbarTool>
            <ToolbarTool onClick={onToday} disabled={isOnCurrentMonth}>
              Today
            </ToolbarTool>
            <ToolbarTool
              onClick={() => {
                setPickerYear(periodYear);
                setPickerOpen((o) => !o);
              }}
              aria-expanded={pickerOpen}
            >
              {periodState.label} ▾
            </ToolbarTool>
            <ToolbarTool onClick={onNextMonth} aria-label="Next month">
              ▶
            </ToolbarTool>
            {pickerOpen && (
              <PickerPopover aria-label="Pick period">
                <PickerHeader>
                  <PickerYearButton
                    onClick={() => setPickerYear((y) => y - 1)}
                    aria-label="Previous year"
                  >
                    ◀
                  </PickerYearButton>
                  <PickerYearLabel>{pickerYear}</PickerYearLabel>
                  <PickerYearButton
                    onClick={() => setPickerYear((y) => y + 1)}
                    aria-label="Next year"
                  >
                    ▶
                  </PickerYearButton>
                </PickerHeader>
                <PickerGrid>
                  {MONTH_LABELS_SHORT.map((short, i) => (
                    <PickerMonth
                      key={short}
                      $current={pickerYear === periodYear && i === periodMonth}
                      onClick={() => navigateToMonth(pickerYear, i)}
                    >
                      {short}
                    </PickerMonth>
                  ))}
                </PickerGrid>
              </PickerPopover>
            )}
          </PeriodNavWrapper>
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

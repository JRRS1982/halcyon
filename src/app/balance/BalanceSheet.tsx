"use client";

import { Sheet } from "@/components/sheet/Sheet";
import { SheetCell } from "@/components/sheet/SheetCell";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSpacer,
  ToolbarTool,
} from "@/components/sheet/Toolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPip, type StatusPipState } from "@/components/ui/StatusPip";
import {
  type BalanceCategory,
  type BalanceType,
  canMove,
  computeMove,
} from "@/lib/balance/reorder";
import {
  MONTH_LABELS_SHORT,
  formatYm,
  nextMonth,
  previousMonth,
} from "@/lib/budget/period";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styled, { css } from "styled-components";
import { ensurePeriodForMonth } from "../budget/actions";
import {
  createBalanceItem,
  deleteBalanceItem,
  moveBalanceItem,
  updateBalanceItem,
} from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SerializedPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type { BalanceType, BalanceCategory };

export type SerializedBalanceItem = {
  id: string;
  type: BalanceType;
  category: BalanceCategory;
  label: string;
  value: number;
  notes: string | null;
  sortOrder: number;
};

type FocusedCell = {
  itemId: string;
  field: "label" | "value" | "notes";
} | null;

// The three category buckets shown under each section. Rendered always —
// even when empty — so the user can see where to add a row.
const CATEGORIES: { key: BalanceCategory; label: string }[] = [
  { key: "CURRENT", label: "Current" },
  { key: "LONG_TERM", label: "Long-term" },
  { key: "OTHER", label: "Other" },
];

// ─── Layout ─────────────────────────────────────────────────────────────────

// 3-column grid: Label (flex), Value (200px right-aligned tabular nums),
// Notes (flex, slightly wider than label). Different from /budget's 5-column
// grid because the balance sheet has no Actual / Variance / % columns.
const GRID = "1fr 200px 1.5fr";

const baseRow = css`
  display: grid;
  grid-template-columns: ${GRID};
`;

const HeadRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.body};
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
`;

// Top-level band — Assets / Liabilities. Dark canvas, mono-caps label.
const SectionRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasDark};
    color: ${({ theme }) => theme.colors.onDark};
    border-color: ${({ theme }) => theme.colors.hairlineDark};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    &:nth-child(1) {
      font-family: ${({ theme }) => theme.typography.monoCaps.family};
      font-size: ${({ theme }) => theme.typography.monoCaps.size};
      font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
      text-transform: uppercase;
      letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    }
    &:nth-child(n + 2) {
      font-weight: 500;
    }
  }
`;

// Sub-section band for the three category buckets. Softer than the section
// band so the visual hierarchy reads Section > Subhead > Item.
const SubheadRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    color: ${({ theme }) => theme.colors.body};
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    color: ${({ theme }) => theme.colors.body};
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

const ItemRow = styled.div`
  ${baseRow}
`;

const TotalsRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.canvasSoft};
    border-top: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
    color: ${({ theme }) => theme.colors.body};
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

const GrandRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
    border-color: ${({ theme }) => theme.colors.primary};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
  }
  > div:nth-child(1) {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: ${({ theme }) => theme.typography.monoCaps.size};
    font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  }
  > div:nth-child(n + 2) {
    font-size: ${({ theme }) => theme.typography.amountXl.size};
    font-weight: ${({ theme }) => theme.typography.amountXl.weight};
    line-height: ${({ theme }) => theme.typography.amountXl.lineHeight};
    letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  }
`;

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

// Same pattern as /budget's AmountInput — local draft string while focused
// so re-formatting doesn't fight the user mid-keystroke.
function AmountInput({
  value,
  onCommit,
  onFocus,
}: {
  value: number;
  onCommit: (n: number) => void;
  onFocus: () => void;
}) {
  const formatted = value === 0 ? "" : value.toFixed(2);
  const [draft, setDraft] = useState(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatted);
  }, [formatted, focused]);

  return (
    <CellInput
      $align="right"
      value={draft}
      placeholder="0.00"
      inputMode="decimal"
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next === "") {
          onCommit(0);
          return;
        }
        const n = Number.parseFloat(next);
        if (Number.isFinite(n) && n >= 0) onCommit(n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number.parseFloat(draft);
        const final = Number.isFinite(n) && n >= 0 ? n : 0;
        setDraft(final === 0 ? "" : final.toFixed(2));
        if (final !== value) onCommit(final);
      }}
    />
  );
}

// ─── Page chrome ────────────────────────────────────────────────────────────

const PageShell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
`;

const PeriodLabel = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

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

    &:hover:not(:disabled) {
      border-color: ${theme.colors.ink};
    }
  `}
`;

// ─── Save pip text helper ───────────────────────────────────────────────────

const pipState = (
  pending: number,
  error: string | null,
  lastSaved: Date | null,
  now: Date,
): { state: StatusPipState; text: string } => {
  if (error) return { state: "error", text: "Failed — retry" };
  if (pending > 0) return { state: "saving", text: "Saving…" };
  if (!lastSaved) return { state: "saved", text: "No changes yet" };
  const diff = Math.max(0, now.getTime() - lastSaved.getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return { state: "saved", text: "Saved just now" };
  if (seconds < 60) return { state: "saved", text: `Saved ${seconds}s ago` };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { state: "saved", text: `Saved ${minutes}m ago` };
  const hours = Math.floor(minutes / 60);
  return { state: "saved", text: `Saved ${hours}h ago` };
};

// ─── Component ──────────────────────────────────────────────────────────────

export function BalanceSheet({
  period,
  initialItems,
  year,
  month,
  currency,
}: {
  period: SerializedPeriod;
  initialItems: SerializedBalanceItem[];
  year: number;
  month: number;
  currency: string;
}) {
  const periodYear = year;
  const periodMonth = month;

  const [periodState, setPeriodState] = useState(period);
  const [items, setItems] = useState(initialItems);
  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);
  const pendingSavesRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());

  // ─── Period nav ───────────────────────────────────────────────────────────

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

  const navigateToMonth = useCallback(
    (targetYear: number, targetMonth: number) => {
      setPickerOpen(false);
      startTransition(() => {
        router.push(`/balance?ym=${formatYm(targetYear, targetMonth)}`);
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

  // ─── Auto-focus on add ────────────────────────────────────────────────────

  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(
    null,
  );
  const labelInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!pendingFocusItemId) return;
    const input = labelInputRefs.current.get(pendingFocusItemId);
    if (input) {
      input.focus();
      input.select();
      setPendingFocusItemId(null);
    }
  }, [pendingFocusItemId]);

  // Tick "Saved Xs ago" every 5s.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // ─── Save plumbing ────────────────────────────────────────────────────────

  const performUpdate = useCallback(
    async (
      itemId: string,
      patch: { label?: string; value?: number; notes?: string | null },
    ) => {
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      try {
        await updateBalanceItem({ itemId, ...patch });
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

  const editField = useCallback(
    (
      itemId: string,
      patch: { label?: string; value?: number; notes?: string | null },
    ) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      );
      debouncedUpdate(itemId, patch);
    },
    [debouncedUpdate],
  );

  const onAddRow = useCallback(
    (type: BalanceType, category: BalanceCategory) => {
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          let pid = periodState.id;
          if (!pid) {
            const real = await ensurePeriodForMonth(year, month);
            pid = real.id;
            setPeriodState((prev) => ({ ...prev, id: real.id }));
          }
          const created = await createBalanceItem({
            periodId: pid,
            type,
            category,
            label: "",
          });
          setItems((prev) => [
            ...prev,
            {
              id: created.id,
              type: created.type,
              category: created.category,
              label: created.label,
              value: Number(created.value),
              notes: created.notes,
              sortOrder: created.sortOrder,
            },
          ]);
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

  const onDelete = useCallback(() => {
    if (!focusedCell) return;
    const target = focusedCell.itemId;
    startTransition(async () => {
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      const previous = items;
      setItems((prev) => prev.filter((it) => it.id !== target));
      setFocusedCell(null);
      try {
        await deleteBalanceItem({ itemId: target });
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setItems(previous);
        setSaveError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    });
  }, [focusedCell, items]);

  // Move the focused row up / down. computeMove handles crossing the
  // category and Asset/Liability boundaries one slot at a time. Optimistic:
  // apply locally, then persist; revert on error.
  const onMove = useCallback(
    (direction: "up" | "down") => {
      if (!focusedCell) return;
      const target = focusedCell.itemId;
      const next = computeMove(items, target, direction);
      if (!next) return;
      const previous = items;
      setItems(next);
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          await moveBalanceItem({ itemId: target, direction });
          setLastSavedAt(new Date());
          setSaveError(null);
        } catch (e) {
          setItems(previous);
          setSaveError(e instanceof Error ? e.message : "Move failed");
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingCount(pendingSavesRef.current);
        }
      });
    },
    [focusedCell, items],
  );

  const canMoveUp = focusedCell
    ? canMove(items, focusedCell.itemId, "up")
    : false;
  const canMoveDown = focusedCell
    ? canMove(items, focusedCell.itemId, "down")
    : false;

  // ─── Derived totals ───────────────────────────────────────────────────────

  const groups = useMemo(() => {
    // Bucket items by (type, category) for rendering. Each bucket also gets
    // a precomputed subtotal so the subhead row can show it inline.
    const result: Record<
      BalanceType,
      Record<
        BalanceCategory,
        {
          rows: SerializedBalanceItem[];
          subtotal: number;
        }
      >
    > = {
      ASSET: {
        CURRENT: { rows: [], subtotal: 0 },
        LONG_TERM: { rows: [], subtotal: 0 },
        OTHER: { rows: [], subtotal: 0 },
      },
      LIABILITY: {
        CURRENT: { rows: [], subtotal: 0 },
        LONG_TERM: { rows: [], subtotal: 0 },
        OTHER: { rows: [], subtotal: 0 },
      },
    };
    for (const it of items) {
      const bucket = result[it.type][it.category];
      bucket.rows.push(it);
      bucket.subtotal += it.value;
    }
    for (const t of ["ASSET", "LIABILITY"] as const) {
      for (const c of CATEGORIES) {
        result[t][c.key].rows.sort((a, b) => a.sortOrder - b.sortOrder);
      }
    }
    return result;
  }, [items]);

  const assetsTotal = useMemo(
    () => CATEGORIES.reduce((sum, c) => sum + groups.ASSET[c.key].subtotal, 0),
    [groups],
  );
  const liabilitiesTotal = useMemo(
    () =>
      CATEGORIES.reduce((sum, c) => sum + groups.LIABILITY[c.key].subtotal, 0),
    [groups],
  );
  const netWorth = assetsTotal - liabilitiesTotal;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderItemRow = (item: SerializedBalanceItem) => (
    <ItemRow
      key={item.id}
      onMouseDown={() => setFocusedCell({ itemId: item.id, field: "label" })}
    >
      <SheetCell
        focused={
          focusedCell?.itemId === item.id && focusedCell.field === "label"
        }
      >
        <CellInput
          ref={(el) => {
            if (el) labelInputRefs.current.set(item.id, el);
            else labelInputRefs.current.delete(item.id);
          }}
          value={item.label}
          placeholder="Name this item"
          onChange={(e) => editField(item.id, { label: e.target.value })}
          onFocus={() => setFocusedCell({ itemId: item.id, field: "label" })}
        />
      </SheetCell>
      <SheetCell
        align="right"
        tone={item.value === 0 ? "dim" : "default"}
        focused={
          focusedCell?.itemId === item.id && focusedCell.field === "value"
        }
      >
        <AmountInput
          value={item.value}
          onCommit={(v) => editField(item.id, { value: v })}
          onFocus={() => setFocusedCell({ itemId: item.id, field: "value" })}
        />
      </SheetCell>
      <SheetCell
        tone={!item.notes ? "dim" : "default"}
        focused={
          focusedCell?.itemId === item.id && focusedCell.field === "notes"
        }
      >
        <CellInput
          value={item.notes ?? ""}
          placeholder="Notes (optional)"
          onChange={(e) =>
            editField(item.id, { notes: e.target.value || null })
          }
          onFocus={() => setFocusedCell({ itemId: item.id, field: "notes" })}
        />
      </SheetCell>
    </ItemRow>
  );

  const renderSection = (type: BalanceType, label: string, total: number) => (
    <>
      <SectionRow>
        <SheetCell>{label}</SheetCell>
        <SheetCell align="right">{formatAmount(currency, total)}</SheetCell>
        <SheetCell />
      </SectionRow>
      {CATEGORIES.map((c) => {
        const bucket = groups[type][c.key];
        return (
          <div key={`${type}-${c.key}`}>
            <SubheadRow>
              <SheetCell>{c.label}</SheetCell>
              <SheetCell align="right">
                {formatAmount(currency, bucket.subtotal)}
              </SheetCell>
              <SheetCell />
            </SubheadRow>
            {bucket.rows.map(renderItemRow)}
          </div>
        );
      })}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  const pip = pipState(pendingCount, saveError, lastSavedAt, now);

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <>
            Balance · <PeriodLabel>{periodState.label}</PeriodLabel>
          </>
        }
        title="Balance Sheet"
        lead="Assets and liabilities snapshot for this period."
        actions={<StatusPip state={pip.state}>{pip.text}</StatusPip>}
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
                  {MONTH_LABELS_SHORT.map((m, i) => (
                    <PickerMonth
                      key={m}
                      onClick={() => navigateToMonth(pickerYear, i)}
                      $current={pickerYear === periodYear && i === periodMonth}
                    >
                      {m}
                    </PickerMonth>
                  ))}
                </PickerGrid>
              </PickerPopover>
            )}
          </PeriodNavWrapper>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={() => onAddRow("ASSET", "CURRENT")}>
            + Asset
          </ToolbarTool>
          <ToolbarTool onClick={() => onAddRow("LIABILITY", "CURRENT")}>
            + Liability
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={() => onMove("up")} disabled={!canMoveUp}>
            ↑ Move up
          </ToolbarTool>
          <ToolbarTool onClick={() => onMove("down")} disabled={!canMoveDown}>
            ↓ Move down
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarTool onClick={onDelete} disabled={!focusedCell}>
            × Delete
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
      </Toolbar>
      <Sheet>
        <HeadRow>
          <SheetCell>Item</SheetCell>
          <SheetCell align="right">Value</SheetCell>
          <SheetCell>Notes</SheetCell>
        </HeadRow>
        {renderSection("ASSET", "Assets", assetsTotal)}
        <TotalsRow>
          <SheetCell>Total assets</SheetCell>
          <SheetCell align="right">
            {formatAmount(currency, assetsTotal)}
          </SheetCell>
          <SheetCell />
        </TotalsRow>
        {renderSection("LIABILITY", "Liabilities", liabilitiesTotal)}
        <TotalsRow>
          <SheetCell>Total liabilities</SheetCell>
          <SheetCell align="right">
            {formatAmount(currency, liabilitiesTotal)}
          </SheetCell>
          <SheetCell />
        </TotalsRow>
        <GrandRow>
          <SheetCell>Net worth</SheetCell>
          <SheetCell
            align="right"
            tone={
              netWorth === 0
                ? "default"
                : netWorth > 0
                  ? "positive"
                  : "negative"
            }
          >
            {formatAmount(currency, netWorth)}
          </SheetCell>
          <SheetCell />
        </GrandRow>
      </Sheet>
    </PageShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styled from "styled-components";
import { Sheet } from "@/components/sheet/Sheet";
import {
  SheetGrandRow,
  SheetHeadRow,
  SheetItemRow,
  SheetSectionRow,
  SheetSubheadRow,
} from "@/components/sheet/SheetRow";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarPeriodLabel,
  ToolbarSelect,
  ToolbarSpacer,
  ToolbarTool,
} from "@/components/sheet/Toolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPip, type StatusPipState } from "@/components/ui/StatusPip";
import {
  formatYm,
  MONTH_LABELS_SHORT,
  nextMonth,
  previousMonth,
} from "@/lib/budget/period";
import {
  computeRollups,
  grandTotals,
  sectionTotals,
} from "@/lib/budget/totals";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  caretAfterSignificant,
  formatAmount,
  formatNumber,
  formatSignedAmount,
  groupForEditing,
  NUMBER_FORMAT_SPEC,
  type NumberFormat,
  parseEditable,
  significantBefore,
} from "@/lib/settings/currency";
import {
  copyBudgetTemplateInto,
  copyPeriodFrom,
  createItemForMonth,
  deleteItem,
  listCopyablePeriods,
  saveBudgetTemplate,
  updateItem,
} from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SerializedPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type ExpenseCategory = "FIXED" | "VARIABLE" | "DISCRETIONARY";
export type IncomeCategory =
  | "SALARY"
  | "SIDE_INCOME"
  | "INVESTMENTS"
  | "PENSIONS"
  | "OTHER";

export type SerializedItem = {
  id: string;
  // Mirrors the full Prisma ItemType enum: a BudgetItem can be any of the
  // four kinds. The sheet's own UI (onAddRow, buildSectionOrder) still only
  // deals in INCOME/EXPENSE — TRANSFER/REPAYMENT rendering is unowned by
  // this component until a later task builds it.
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  category: ExpenseCategory | null;
  incomeCategory: IncomeCategory | null;
  categoryId: string | null;
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

// Currency formatters live in @/lib/settings/currency and take the user's
// currency code so the same symbol is rendered everywhere.

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

// Numeric cell input.
//   - while focused: shows a raw, editable string (plain digits, "." decimal,
//     no grouping) so typing isn't fought by re-formatting mid-keystroke
//   - while unfocused: shows the value formatted per the user's number format
//     (thousands separators + decimals); the symbol shows only when idle
//   - onChange emits a parsed number so the debounced save fires per keystroke
//   - onBlur commits the normalised value
function AmountInput({
  value,
  currency,
  numberFormat,
  onCommit,
  onFocus,
  onKeyDown,
  inputRef,
}: {
  value: number;
  currency: string;
  numberFormat: NumberFormat;
  onCommit: (n: number) => void;
  onFocus: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const localRef = useRef<HTMLInputElement | null>(null);
  // Caret position to restore after regrouping shifts the separators.
  const caretRef = useRef<number | null>(null);

  const setRef = (el: HTMLInputElement | null) => {
    localRef.current = el;
    inputRef?.(el);
  };

  // Reapply the caret after a regrouped draft re-renders, so inserting a
  // thousands separator doesn't bump the cursor to the end.
  useLayoutEffect(() => {
    if (!focused || caretRef.current === null || !localRef.current) return;
    const pos = Math.min(caretRef.current, draft.length);
    localRef.current.setSelectionRange(pos, pos);
    caretRef.current = null;
  }, [draft, focused]);

  // Unfocused cells show the currency symbol, focused ones don't: DESIGN.md →
  // Typography → Amounts requires the symbol on any amount on display, and an
  // idle cell is on display. Focusing hands the user the bare number to edit,
  // which keeps the symbol out of parseEditable/groupForEditing — those strip
  // every non-digit and drive the caret restoration, so putting a prefix
  // through them would complicate the most keyboard-sensitive code in the app
  // to no benefit the user can see.
  const display = focused
    ? draft
    : value === 0
      ? ""
      : formatAmount(currency, value, numberFormat);

  return (
    <CellInput
      ref={setRef}
      $align="right"
      value={display}
      placeholder={
        NUMBER_FORMAT_SPEC[numberFormat].decimals === 0 ? "0" : "0.00"
      }
      inputMode="decimal"
      onKeyDown={onKeyDown}
      onFocus={() => {
        setFocused(true);
        // Start from the same grouped form shown when unfocused, so focusing a
        // cell doesn't change how the number looks.
        setDraft(value === 0 ? "" : formatNumber(value, numberFormat));
        onFocus();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        const sig = significantBefore(raw, caret, numberFormat);
        const formatted = groupForEditing(raw, numberFormat);
        setDraft(formatted);
        caretRef.current = caretAfterSignificant(formatted, sig, numberFormat);
        onCommit(parseEditable(formatted, numberFormat));
      }}
      onBlur={() => {
        setFocused(false);
        const final = parseEditable(draft, numberFormat);
        if (final !== value) onCommit(final);
      }}
    />
  );
}

const PageShell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile.
     The sheet is the widest thing on the page, so those 16px are the
     difference between the Actual column landing on screen and off it. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

// Accent-coloured period date in the page eyebrow. Bold + blue — the single
// orientation moment on the page per DESIGN.md → Do's.
const PeriodLabel = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

// Category subhead label cell content: the bucket name + an info "i" button.
const SubheadLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const InfoButton = styled.button`
  ${({ theme }) => `
    text-transform: none;
    letter-spacing: normal;
    width: 16px;
    height: 16px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.rounded.full};
    border: 1px solid ${theme.colors.hairlineStrong};
    background: ${theme.colors.canvas};
    color: ${theme.colors.body};
    font-family: ${theme.typography.bodyMd.family};
    font-size: 10px;
    font-weight: 600;
    font-style: italic;
    line-height: 1;
    cursor: pointer;

    &:hover {
      border-color: ${theme.colors.ink};
      color: ${theme.colors.ink};
    }
  `}
`;

// Fixed-position so it isn't clipped by the Sheet's overflow:hidden.
const InfoPopover = styled.div`
  ${({ theme }) => `
    position: fixed;
    z-index: 50;
    max-width: 280px;
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    box-shadow: rgba(15, 17, 22, 0.12) 0px 6px 16px 0px;
    padding: ${theme.spacing.md};
    text-transform: none;
    letter-spacing: normal;
  `}
`;

const InfoTitle = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: ${theme.typography.bodyMdStrong.size};
    font-weight: ${theme.typography.bodyMdStrong.weight};
    color: ${theme.colors.ink};
    margin-bottom: ${theme.spacing.xs};
  `}
`;

const InfoBody = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
  `}
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

// Copy-from popover: anchored under its toolbar button like the period picker.
const CopyWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const CopyPopover = styled.div`
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
    min-width: 260px;
  `}
`;

const CopyTitle = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: ${theme.typography.bodyMdStrong.size};
    font-weight: ${theme.typography.bodyMdStrong.weight};
    color: ${theme.colors.ink};
    padding-bottom: ${theme.spacing.sm};
    border-bottom: 1px solid ${theme.colors.hairline};
    margin-bottom: ${theme.spacing.sm};
  `}
`;

const CopyMuted = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.dim};
    padding: ${theme.spacing.sm} 0;
  `}
`;

const CopyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  max-height: 220px;
  overflow-y: auto;
`;

const CopySource = styled.button<{ $selected?: boolean }>`
  ${({ theme, $selected }) => `
    text-align: left;
    background: ${$selected ? theme.colors.primary : theme.colors.canvas};
    color: ${$selected ? theme.colors.onPrimary : theme.colors.ink};
    border: 1px solid ${$selected ? theme.colors.primary : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    padding: ${theme.spacing.sm};
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: ${theme.colors.ink};
    }
  `}
`;

const CopyConfirm = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.spacing.sm};
    padding-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.hairline};
  `}
`;

const CopyConfirmText = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin-bottom: ${theme.spacing.sm};
  `}
`;

const CopyActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CopyButton = styled.button<{ $primary?: boolean }>`
  ${({ theme, $primary }) => `
    background: ${$primary ? theme.colors.primary : theme.colors.canvas};
    color: ${$primary ? theme.colors.onPrimary : theme.colors.ink};
    border: 1px solid ${$primary ? theme.colors.primary : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: ${theme.colors.ink};
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `}
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

// The rows for one category bucket, sorted by sortOrder. Expenses match on
// `category`, income on `incomeCategory`.
function buildSectionOrder(
  items: SerializedItem[],
  type: "INCOME" | "EXPENSE",
  category: ExpenseCategory | IncomeCategory,
): SerializedItem[] {
  return items
    .filter(
      (i) =>
        i.type === type &&
        (type === "EXPENSE"
          ? i.category === category
          : i.incomeCategory === category),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// The three expense buckets, in display order, with labels + help text.
const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  help: string;
}[] = [
  {
    key: "FIXED",
    label: "Fixed",
    help: "Locked-in commitments that stay roughly the same each month — rent or mortgage, insurance, loan repayments, subscriptions.",
  },
  {
    key: "VARIABLE",
    label: "Variable",
    help: "Necessary spending that fluctuates month to month — groceries, utilities, fuel, phone usage.",
  },
  {
    key: "DISCRETIONARY",
    label: "Discretionary",
    help: "Wants you could cut back without real hardship — eating out, entertainment, hobbies, shopping.",
  },
];

// The five income buckets, in display order, with labels + help text.
const INCOME_CATEGORIES: {
  key: IncomeCategory;
  label: string;
  help: string;
}[] = [
  {
    key: "SALARY",
    label: "Salary",
    help: "Your primary employment income — net of tax and pension (what actually lands in your account).",
  },
  {
    key: "SIDE_INCOME",
    label: "Side income",
    help: "Freelance, gigs, a second job, hobby earnings.",
  },
  {
    key: "INVESTMENTS",
    label: "Investments",
    help: "Bank interest, dividends, fund distributions, rental income.",
  },
  {
    key: "PENSIONS",
    label: "Pensions",
    help: "State pension, workplace pension drawdown, SIPP withdrawals, annuities.",
  },
  {
    key: "OTHER",
    label: "Other",
    help: "Gifts, refunds, government support, one-off receipts.",
  },
];

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

// Sentinel "source" id for the saved template entry in the Copy-from list,
// distinct from any real period uuid.
const TEMPLATE_SOURCE_ID = "__template__";

export function BudgetSheet({
  period,
  initialItems,
  year,
  month,
  currency,
  numberFormat,
  hasTemplate,
  actualsReadOnly = false,
}: {
  period: SerializedPeriod;
  initialItems: SerializedItem[];
  year: number;
  month: number;
  currency: string;
  numberFormat: NumberFormat;
  hasTemplate: boolean;
  actualsReadOnly?: boolean;
}) {
  // Bind currency + number format once so the many call sites stay terse.
  const fmtAmount = (n: number) => formatAmount(currency, n, numberFormat);
  const fmtSigned = (n: number) =>
    formatSignedAmount(currency, n, numberFormat);
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

  // Per-subhead info popover. Fixed-positioned at the clicked icon's rect so
  // it escapes the Sheet's overflow:hidden clipping.
  const [openInfo, setOpenInfo] = useState<{
    title: string;
    body: string;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!openInfo) return;
    const close = () => setOpenInfo(null);
    const onDocMouseDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-info-root]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [openInfo]);

  // ─── Period navigation state ──────────────────────────────────────────────

  const router = useRouter();
  const periodYear = year;
  const periodMonth = month;

  // What the "Today" button targets — recomputed on render so it stays fresh
  // if the user leaves the tab open across a date boundary.
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, []);
  const isOnCurrentMonth =
    periodYear === today.year && periodMonth === today.month;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(periodYear);
  const pickerWrapperRef = useRef<HTMLDivElement | null>(null);

  // ─── Copy-from popover state ──────────────────────────────────────────────

  const [copyOpen, setCopyOpen] = useState(false);
  // null while the period list is loading; an array once fetched.
  const [copyList, setCopyList] = useState<
    { id: string; label: string }[] | null
  >(null);
  const [copySelectedId, setCopySelectedId] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const copyWrapperRef = useRef<HTMLDivElement | null>(null);

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

  // Close the copy-from popover on outside click.
  useEffect(() => {
    if (!copyOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        copyWrapperRef.current &&
        !copyWrapperRef.current.contains(e.target as Node)
      ) {
        setCopyOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [copyOpen]);

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

  // Open the copy-from popover and fetch the candidate source months. The
  // current period is filtered out — you can't copy a month onto itself.
  const openCopy = useCallback(() => {
    setCopySelectedId(null);
    setCopyList(null);
    setCopyOpen(true);
    startTransition(async () => {
      try {
        const periods = await listCopyablePeriods();
        setCopyList(periods.filter((p) => p.id !== periodState.id));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Couldn't load periods");
        setCopyOpen(false);
      }
    });
  }, [periodState.id]);

  // Overwrite the current month with a copy of the selected source — either a
  // chosen month, or the user's saved budget template (TEMPLATE_SOURCE_ID).
  const confirmCopy = useCallback(() => {
    if (!copySelectedId) return;
    setCopyBusy(true);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        const result =
          copySelectedId === TEMPLATE_SOURCE_ID
            ? await copyBudgetTemplateInto({
                targetYear: year,
                targetMonth: month,
              })
            : await copyPeriodFrom({
                sourcePeriodId: copySelectedId,
                targetYear: year,
                targetMonth: month,
              });
        setPeriodState((prev) => ({ ...prev, id: result.periodId }));
        setItems(result.items);
        setFocusedCell(null);
        setLastSavedAt(new Date());
        setSaveError(null);
        setCopyOpen(false);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Copy failed");
      } finally {
        setCopyBusy(false);
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    });
  }, [copySelectedId, year, month]);

  // ─── Save-as-template state ───────────────────────────────────────────────

  const [templateExists, setTemplateExists] = useState(hasTemplate);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [saveTplBusy, setSaveTplBusy] = useState(false);
  const saveTplWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!saveTplOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        saveTplWrapperRef.current &&
        !saveTplWrapperRef.current.contains(e.target as Node)
      ) {
        setSaveTplOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [saveTplOpen]);

  // Snapshot this month's rows into the user's reusable budget template.
  const confirmSaveTemplate = useCallback(() => {
    if (!periodState.id) return;
    setSaveTplBusy(true);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        await saveBudgetTemplate({ sourcePeriodId: periodState.id });
        setTemplateExists(true);
        setLastSavedAt(new Date());
        setSaveError(null);
        setSaveTplOpen(false);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save template failed");
      } finally {
        setSaveTplBusy(false);
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    });
  }, [periodState.id]);

  // When a row is just added, we want the user to land in its label input
  // immediately so they can type a name without an extra click.
  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(
    null,
  );

  // Every editable cell input, keyed `${itemId}:${field}`, so Enter can move
  // focus to the same field one row down (see onCellKeyDown).
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const registerCell = (key: string) => (el: HTMLInputElement | null) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  useEffect(() => {
    if (!pendingFocusItemId) return;
    // The new row's input has just mounted in the same batch as
    // setPendingFocusItemId, so the ref should be populated by now.
    const input = cellRefs.current.get(`${pendingFocusItemId}:label`);
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

  const debouncedUpdate = useDebouncedCallback(
    performUpdate,
    500,
    (itemId) => itemId,
  );

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

  // Re-bucket a top-level expense row. Optimistic + immediate save (not
  // debounced — it's a discrete click, not typing).
  const editCategory = useCallback(
    (itemId: string, category: ExpenseCategory) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, category } : it)),
      );
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          await updateItem({ itemId, category });
          setLastSavedAt(new Date());
          setSaveError(null);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : "Save failed");
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingCount(pendingSavesRef.current);
        }
      });
    },
    [],
  );

  const editIncomeCategory = useCallback(
    (itemId: string, incomeCategory: IncomeCategory) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, incomeCategory } : it)),
      );
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          await updateItem({ itemId, incomeCategory });
          setLastSavedAt(new Date());
          setSaveError(null);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : "Save failed");
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingCount(pendingSavesRef.current);
        }
      });
    },
    [],
  );

  const onAddRow = useCallback(
    (type: "INCOME" | "EXPENSE") => {
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          // The period row is created lazily, with the first item that needs
          // it — one action, so a month can never end up with a period and no
          // rows. Once it exists, subsequent adds reuse the id it returns.
          const { periodId, item: created } = await createItemForMonth({
            year,
            month,
            type,
            label: "",
          });
          if (!periodState.id) {
            setPeriodState((prev) => ({ ...prev, id: periodId }));
          }
          setItems((prev) => [
            ...prev,
            {
              id: created.id,
              type: created.type,
              category: created.category,
              incomeCategory: created.incomeCategory,
              categoryId: created.categoryId ?? null,
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

  const rollups = useMemo(() => computeRollups(items), [items]);

  // Expenses grouped into their three category buckets, each with its rows and
  // a bucket subtotal.
  const expenseBuckets = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((cat) => {
        const rows = buildSectionOrder(items, "EXPENSE", cat.key);
        let budget = 0;
        let actual = 0;
        for (const item of rows) {
          const r = rollups.get(item.id);
          if (!r) continue;
          budget += r.budget;
          actual += r.actual;
        }
        const variance = budget - actual;
        const variancePct =
          budget === 0 ? 0 : Math.round((actual / budget) * 100);
        return { cat, rows, totals: { budget, actual, variance, variancePct } };
      }),
    [items, rollups],
  );

  // Income grouped into the five income buckets, same shape as expenseBuckets.
  const incomeBuckets = useMemo(
    () =>
      INCOME_CATEGORIES.map((cat) => {
        const rows = buildSectionOrder(items, "INCOME", cat.key);
        let budget = 0;
        let actual = 0;
        for (const item of rows) {
          const r = rollups.get(item.id);
          if (!r) continue;
          budget += r.budget;
          actual += r.actual;
        }
        const variance = budget - actual;
        const variancePct =
          budget === 0 ? 0 : Math.round((actual / budget) * 100);
        return { cat, rows, totals: { budget, actual, variance, variancePct } };
      }),
    [items, rollups],
  );

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

  // The focused row, if any — drives the category dropdown and delete button.
  const focusedItem = useMemo(
    () =>
      focusedCell
        ? (items.find((i) => i.id === focusedCell.itemId) ?? null)
        : null,
    [focusedCell, items],
  );

  // Item ids in the order they're rendered (income buckets, then expense
  // buckets), so Enter can step to the next row down.
  const orderedItemIds = useMemo(
    () =>
      [
        ...incomeBuckets.flatMap((b) => b.rows),
        ...expenseBuckets.flatMap((b) => b.rows),
      ].map((it) => it.id),
    [incomeBuckets, expenseBuckets],
  );

  // Enter moves focus to the same field one row down (matching the header's
  // "Enter drops down"). No-op on the last row.
  const onCellKeyDown = useCallback(
    (
      itemId: string,
      field: "label" | "budget" | "actual",
    ): KeyboardEventHandler<HTMLInputElement> =>
      (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const idx = orderedItemIds.indexOf(itemId);
        const nextId = orderedItemIds[idx + 1];
        if (nextId) cellRefs.current.get(`${nextId}:${field}`)?.focus();
      },
    [orderedItemIds],
  );

  // ─── Delete ───────────────────────────────────────────────────────────────

  const onDelete = useCallback(() => {
    if (!focusedItem) return;
    const target = focusedItem;

    // Optimistic — drop the row from local state immediately, clear focus.
    setItems((prev) => prev.filter((it) => it.id !== target.id));
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
  }, [focusedItem]);

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

  const renderItemRow = (item: SerializedItem) => {
    return (
      <SheetItemRow
        key={item.id}
        depth={1}
        variant="default"
        onSelect={() => setFocusedCell({ itemId: item.id, field: "label" })}
        label={
          <CellInput
            ref={registerCell(`${item.id}:label`)}
            value={item.label}
            placeholder="Name this row"
            onChange={(e) => editField(item.id, { label: e.target.value })}
            onKeyDown={onCellKeyDown(item.id, "label")}
            onFocus={() => setFocusedCell({ itemId: item.id, field: "label" })}
          />
        }
        amounts={{
          budget: {
            value: (
              <AmountInput
                currency={currency}
                value={item.budget}
                numberFormat={numberFormat}
                inputRef={registerCell(`${item.id}:budget`)}
                onCommit={(v) => editField(item.id, { budget: v })}
                onKeyDown={onCellKeyDown(item.id, "budget")}
                onFocus={() =>
                  setFocusedCell({ itemId: item.id, field: "budget" })
                }
              />
            ),
            tone: item.budget === 0 ? "dim" : "default",
          },
          actual: {
            // When transactions mode is on, actual is the computed sum of the
            // category's transactions — read-only, rendered as static text so
            // there's no edit path that could overwrite the stored value.
            value: actualsReadOnly ? (
              fmtAmount(item.actual)
            ) : (
              <AmountInput
                currency={currency}
                value={item.actual}
                numberFormat={numberFormat}
                inputRef={registerCell(`${item.id}:actual`)}
                onCommit={(v) => editField(item.id, { actual: v })}
                onKeyDown={onCellKeyDown(item.id, "actual")}
                onFocus={() =>
                  setFocusedCell({ itemId: item.id, field: "actual" })
                }
              />
            ),
            tone: item.actual === 0 ? "dim" : "default",
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
        title={
          <>
            Budget · <PeriodLabel>{periodState.label}</PeriodLabel>
          </>
        }
        lead="Click any cell to edit. Tab moves right, Enter drops down. Totals recalc as you type."
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
            <ToolbarPeriodLabel
              onClick={() => {
                setPickerYear(periodYear);
                setPickerOpen((o) => !o);
              }}
              aria-expanded={pickerOpen}
            >
              {periodState.label} ▾
            </ToolbarPeriodLabel>
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
        {/* Adding rows comes first because it is what people do most, and the
            leftmost group after the period is the one they read. Filling from
            elsewhere and saving a template are month-level operations, so they
            sit together after it. */}
        <ToolbarGroup>
          <ToolbarTool onClick={() => onAddRow("INCOME")}>+ Income</ToolbarTool>
          <ToolbarTool onClick={() => onAddRow("EXPENSE")}>
            + Expense
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarGroup>
          <CopyWrapper ref={copyWrapperRef}>
            {/* "Copy from…" left both ends unsaid — copy what, into where, and
                "copy" reads as clipboard. This names the direction; the popover
                names the source. "This month" rather than the label itself, so
                the button keeps one width as you navigate and the groups after
                it don't shuffle. */}
            <ToolbarTool
              onClick={() => (copyOpen ? setCopyOpen(false) : openCopy())}
              aria-expanded={copyOpen}
            >
              Fill this month from…
            </ToolbarTool>
            {copyOpen && (
              <CopyPopover aria-label="Fill this month from another month">
                <CopyTitle>Fill {periodState.label} from</CopyTitle>
                {copyList === null ? (
                  <CopyMuted>Loading…</CopyMuted>
                ) : copyList.length === 0 && !templateExists ? (
                  <CopyMuted>
                    No template or other months to copy from yet.
                  </CopyMuted>
                ) : (
                  <CopyList>
                    {templateExists && (
                      <CopySource
                        type="button"
                        $selected={copySelectedId === TEMPLATE_SOURCE_ID}
                        onClick={() => setCopySelectedId(TEMPLATE_SOURCE_ID)}
                      >
                        ★ Template
                      </CopySource>
                    )}
                    {copyList.map((p) => (
                      <CopySource
                        key={p.id}
                        type="button"
                        $selected={p.id === copySelectedId}
                        onClick={() => setCopySelectedId(p.id)}
                      >
                        {p.label}
                      </CopySource>
                    ))}
                  </CopyList>
                )}
                {copySelectedId && (
                  <CopyConfirm>
                    <CopyConfirmText>
                      {items.length > 0
                        ? `This replaces the rows in ${periodState.label}. `
                        : ""}
                      Budgeted amounts carry over; actuals reset to 0.
                    </CopyConfirmText>
                    <CopyActions>
                      <CopyButton
                        type="button"
                        onClick={() => setCopyOpen(false)}
                        disabled={copyBusy}
                      >
                        Cancel
                      </CopyButton>
                      <CopyButton
                        type="button"
                        $primary
                        onClick={confirmCopy}
                        disabled={copyBusy}
                      >
                        {copyBusy ? "Filling…" : "Fill"}
                      </CopyButton>
                    </CopyActions>
                  </CopyConfirm>
                )}
              </CopyPopover>
            )}
          </CopyWrapper>
          <CopyWrapper ref={saveTplWrapperRef}>
            <ToolbarTool
              onClick={() => setSaveTplOpen((o) => !o)}
              aria-expanded={saveTplOpen}
              disabled={items.length === 0}
            >
              Save as template
            </ToolbarTool>
            {saveTplOpen && (
              <CopyPopover aria-label="Save this month as your budget template">
                <CopyTitle>Save as budget template</CopyTitle>
                <CopyConfirmText>
                  {templateExists
                    ? "Replaces your current budget template. "
                    : ""}
                  Saves this month's rows (structure + budgets) as your reusable
                  template.
                </CopyConfirmText>
                <CopyActions>
                  <CopyButton
                    type="button"
                    onClick={() => setSaveTplOpen(false)}
                    disabled={saveTplBusy}
                  >
                    Cancel
                  </CopyButton>
                  <CopyButton
                    type="button"
                    $primary
                    onClick={confirmSaveTemplate}
                    disabled={saveTplBusy}
                  >
                    {saveTplBusy ? "Saving…" : "Save"}
                  </CopyButton>
                </CopyActions>
              </CopyPopover>
            )}
          </CopyWrapper>
        </ToolbarGroup>
        {focusedItem?.type === "EXPENSE" && (
          <ToolbarGroup $rowScoped $engaged>
            <ToolbarSelect
              aria-label="Expense category"
              value={focusedItem.category ?? "FIXED"}
              onChange={(e) =>
                editCategory(focusedItem.id, e.target.value as ExpenseCategory)
              }
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </ToolbarSelect>
          </ToolbarGroup>
        )}
        {focusedItem?.type === "INCOME" && (
          <ToolbarGroup $rowScoped $engaged>
            <ToolbarSelect
              aria-label="Income category"
              value={focusedItem.incomeCategory ?? "OTHER"}
              onChange={(e) =>
                editIncomeCategory(
                  focusedItem.id,
                  e.target.value as IncomeCategory,
                )
              }
            >
              {INCOME_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </ToolbarSelect>
          </ToolbarGroup>
        )}
        <ToolbarGroup $rowScoped $engaged={!!focusedItem}>
          <ToolbarTool onClick={onDelete} disabled={!focusedItem} $danger>
            × Delete row
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
        <StatusPip state={pipState}>{pipText}</StatusPip>
      </Toolbar>

      <Sheet data-sheet-scroller role="table" aria-label="Budget">
        <SheetHeadRow />

        <SheetSectionRow
          label="Income"
          amounts={{
            budget: fmtAmount(incomeTotals.budget),
            actual: fmtAmount(incomeTotals.actual),
          }}
        />
        {incomeBuckets.map(({ cat, rows, totals }) => (
          <div key={cat.key}>
            <SheetSubheadRow
              label={
                <SubheadLabel>
                  {cat.label}
                  <InfoButton
                    type="button"
                    data-info-root
                    aria-label={`What goes in ${cat.label}?`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpenInfo((prevInfo) =>
                        prevInfo?.title === cat.label
                          ? null
                          : {
                              title: cat.label,
                              body: cat.help,
                              top: r.bottom + 6,
                              left: Math.min(r.left, window.innerWidth - 296),
                            },
                      );
                    }}
                  >
                    i
                  </InfoButton>
                </SubheadLabel>
              }
              amounts={{
                budget: fmtAmount(totals.budget),
                actual: fmtAmount(totals.actual),
              }}
            />
            {rows.map((item) => renderItemRow(item))}
          </div>
        ))}

        <SheetSectionRow
          label="Expenses"
          amounts={{
            budget: fmtAmount(expenseTotals.budget),
            actual: fmtAmount(expenseTotals.actual),
          }}
        />
        {expenseBuckets.map(({ cat, rows, totals }) => (
          <div key={cat.key}>
            <SheetSubheadRow
              label={
                <SubheadLabel>
                  {cat.label}
                  <InfoButton
                    type="button"
                    data-info-root
                    aria-label={`What goes in ${cat.label}?`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpenInfo((prevInfo) =>
                        prevInfo?.title === cat.label
                          ? null
                          : {
                              title: cat.label,
                              body: cat.help,
                              top: r.bottom + 6,
                              left: Math.min(r.left, window.innerWidth - 296),
                            },
                      );
                    }}
                  >
                    i
                  </InfoButton>
                </SubheadLabel>
              }
              amounts={{
                budget: fmtAmount(totals.budget),
                actual: fmtAmount(totals.actual),
              }}
            />
            {rows.map((item) => renderItemRow(item))}
          </div>
        ))}

        <SheetGrandRow
          label="Net income"
          amounts={{
            budget: fmtSigned(grand.budget),
            actual: fmtSigned(grand.actual),
          }}
        />
      </Sheet>
      {openInfo && (
        <InfoPopover
          data-info-root
          style={{ top: openInfo.top, left: openInfo.left }}
        >
          <InfoTitle>{openInfo.title}</InfoTitle>
          <InfoBody>{openInfo.body}</InfoBody>
        </InfoPopover>
      )}
    </PageShell>
  );
}

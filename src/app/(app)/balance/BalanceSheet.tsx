"use client";

import { Sheet } from "@/components/sheet/Sheet";
import { SheetCell } from "@/components/sheet/SheetCell";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarPeriodLabel,
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
import {
  NUMBER_FORMAT_SPEC,
  type NumberFormat,
  formatAmount,
  formatNumber,
} from "@/lib/settings/currency";
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
  copyBalancePeriodFrom,
  copyBalanceTemplateInto,
  createBalanceItem,
  deleteBalanceItem,
  listCopyableBalancePeriods,
  moveBalanceItem,
  saveBalanceTemplate,
  setBalanceItemSection,
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
  { key: "MEDIUM_TERM", label: "Medium-term" },
  { key: "LONG_TERM", label: "Long-term" },
  { key: "PROPERTY", label: "Property" },
  { key: "OTHER", label: "Other" },
];

// Every (type, category) destination for the toolbar's "move to section"
// dropdown, in display order (Assets first, then Liabilities). The value
// encodes both dimensions so a single <select> can move a row anywhere.
const SECTIONS: {
  value: string;
  type: BalanceType;
  category: BalanceCategory;
  label: string;
}[] = (["ASSET", "LIABILITY"] as const).flatMap((type) =>
  CATEGORIES
    // PROPERTY is asset-only; mortgage debt belongs in Long-term liabilities.
    .filter((c) => !(type === "LIABILITY" && c.key === "PROPERTY"))
    .map((c) => ({
      value: `${type}:${c.key}`,
      type,
      category: c.key,
      label: `${type === "ASSET" ? "Assets" : "Liabilities"} · ${c.label}`,
    })),
);

// Guidance shown in the per-subhead info popover. Plain-English, UK-flavoured
// examples — "what should go in this bucket". Edit freely; this is the only
// source of the help text.
const CATEGORY_HELP: Record<
  BalanceType,
  Record<BalanceCategory, { title: string; body: string }>
> = {
  ASSET: {
    CURRENT: {
      title: "Current assets",
      body: "Cash you could spend today — current accounts, instant-access savings, and money owed to you that's due within weeks.",
    },
    MEDIUM_TERM: {
      title: "Medium-term assets",
      body: "Funds you can reach in days, not minutes — cash and stocks-&-shares ISAs, fixed-term savings, brokerage cash.",
    },
    LONG_TERM: {
      title: "Long-term assets",
      body: "Financial investments you expect to hold for years — SIPPs and other pensions, stocks, bonds, and long-term funds.",
    },
    PROPERTY: {
      title: "Property",
      body: "Real estate and land — your home, a buy-to-let, or any other property you own.",
    },
    OTHER: {
      title: "Other assets",
      body: "Anything that doesn't fit above — collectibles, a stake in a business, or longer-dated loans you've made to others.",
    },
  },
  LIABILITY: {
    CURRENT: {
      title: "Current liabilities",
      body: "Debts due within a year — credit-card balances, overdrafts, outstanding bills, and short-term loans.",
    },
    MEDIUM_TERM: {
      title: "Medium-term liabilities",
      body: "Debts you'll clear over a few years — personal loans, car finance, BNPL plans.",
    },
    LONG_TERM: {
      title: "Long-term liabilities",
      body: "Debts that run for many years — your mortgage and student loans.",
    },
    // Asset-only category; this entry satisfies the type but is never rendered
    // (the UI suppresses Liabilities · Property).
    PROPERTY: {
      title: "Property",
      body: "Asset-only category.",
    },
    OTHER: {
      title: "Other liabilities",
      body: "Anything else you owe that doesn't fit above — tax due, personal loans from family, or miscellaneous obligations.",
    },
  },
};

// ─── Layout ─────────────────────────────────────────────────────────────────

// 3-column grid: Label (flex), Value (200px right-aligned tabular nums),
// Notes (flex, slightly wider than label). Different from /budget's 5-column
// grid because the balance sheet has no Actual / Variance / % columns.
const GRID = "1fr 200px 1.5fr";

// Below desktop the row keeps a floor width so the Sheet container (a
// horizontal scroller at the same breakpoints) pans rather than crushing the
// label. The label cell pins to the left edge while Value and Notes scroll
// under it. Mirrors the budget sheet — see SheetRow.styled.
const baseRow = css`
  display: grid;
  grid-template-columns: ${GRID};

  @media (max-width: 991px) {
    grid-template-columns: minmax(200px, 1fr) 140px minmax(200px, 1.5fr);
    min-width: 540px;

    > div:nth-child(1) {
      position: sticky;
      left: 0;
      z-index: 1;
    }
  }

  @media (max-width: 767px) {
    grid-template-columns: minmax(180px, 1fr) 120px minmax(180px, 1.5fr);
    min-width: 480px;
  }
`;

// Top-level band — Assets / Liabilities. Dark canvas, Inter semibold label.
const SectionRow = styled.div`
  ${baseRow}

  > div {
    background: ${({ theme }) => theme.colors.band};
    color: ${({ theme }) => theme.colors.onBand};
    border-color: ${({ theme }) => theme.colors.hairlineBand};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    font-weight: 600;
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
    color: ${({ theme }) => theme.colors.body};
    font-weight: 500;
  }
  > div:nth-child(n + 2) {
    font-weight: 500;
  }
`;

const ItemRow = styled.div`
  ${baseRow}
`;

const GrandRow = styled.div`
  ${baseRow}

  /* Grand total (Net worth): same size as the section headings (Inter 14px),
     semibold — the dark band carries the emphasis, not an oversized type size. */
  > div {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
    border-color: ${({ theme }) => theme.colors.primary};
    padding-top: ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.md};
    font-weight: 600;
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

// Same pattern as /budget's AmountInput — raw editable string while focused,
// formatted per the user's number format when not.
function AmountInput({
  value,
  currency,
  numberFormat,
  onCommit,
  onFocus,
}: {
  value: number;
  currency: string;
  numberFormat: NumberFormat;
  onCommit: (n: number) => void;
  onFocus: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

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
      $align="right"
      value={display}
      placeholder={
        NUMBER_FORMAT_SPEC[numberFormat].decimals === 0 ? "0" : "0.00"
      }
      inputMode="decimal"
      onFocus={() => {
        setFocused(true);
        setDraft(value === 0 ? "" : String(value));
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
        if (final !== value) onCommit(final);
      }}
    />
  );
}

// Toolbar control for moving the focused row into another section. Mirrors
// /budget's CategorySelect styling.
const SectionSelect = styled.select`
  ${({ theme }) => `
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    cursor: pointer;
  `}
`;

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

// Subhead label cell content: the category name + an info "i" button.
const SubheadLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const InfoButton = styled.button`
  ${({ theme }) => `
    /* Reset the mono-caps/uppercase the subhead cell imposes on its text. */
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

// Fixed-position so it isn't clipped by the Sheet's overflow:hidden. Anchored
// to the clicked icon's bounding rect at open time.
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

// ─── Copy-from popover ────────────────────────────────────────────────────────
// Mirrors /budget's Copy-from control: pick a source month, confirm, overwrite.

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

// Sentinel "source" id for the saved template entry in the Copy-from list,
// distinct from any real period uuid.
const TEMPLATE_SOURCE_ID = "__template__";

export function BalanceSheet({
  period,
  initialItems,
  year,
  month,
  currency,
  numberFormat,
  hasTemplate,
}: {
  period: SerializedPeriod;
  initialItems: SerializedBalanceItem[];
  year: number;
  month: number;
  currency: string;
  numberFormat: NumberFormat;
  hasTemplate: boolean;
}) {
  const periodYear = year;
  const periodMonth = month;
  const fmtAmount = (n: number) => formatAmount(currency, n, numberFormat);

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
    // Fixed coords detach on scroll — just dismiss.
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [openInfo]);

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

  // ─── Copy-from popover state ──────────────────────────────────────────────

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyList, setCopyList] = useState<
    { id: string; label: string }[] | null
  >(null);
  const [copySelectedId, setCopySelectedId] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const copyWrapperRef = useRef<HTMLDivElement | null>(null);

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

  // Open the copy-from popover and load candidate source months (those with
  // balance items). The current period is filtered out — can't copy onto self.
  const openCopy = useCallback(() => {
    setCopySelectedId(null);
    setCopyList(null);
    setCopyOpen(true);
    startTransition(async () => {
      try {
        const periods = await listCopyableBalancePeriods();
        setCopyList(periods.filter((p) => p.id !== periodState.id));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Couldn't load periods");
        setCopyOpen(false);
      }
    });
  }, [periodState.id]);

  // Overwrite the current month's balance rows with a copy of the selected
  // source — either a chosen month, or the saved balance template.
  const confirmCopy = useCallback(() => {
    if (!copySelectedId) return;
    setCopyBusy(true);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        const result =
          copySelectedId === TEMPLATE_SOURCE_ID
            ? await copyBalanceTemplateInto({
                targetYear: year,
                targetMonth: month,
              })
            : await copyBalancePeriodFrom({
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

  // Snapshot this month's balance rows into the user's reusable template.
  const confirmSaveTemplate = useCallback(() => {
    if (!periodState.id) return;
    setSaveTplBusy(true);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        await saveBalanceTemplate({ sourcePeriodId: periodState.id });
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

  const focusedItem = useMemo(
    () =>
      focusedCell
        ? (items.find((i) => i.id === focusedCell.itemId) ?? null)
        : null,
    [focusedCell, items],
  );

  // Jump the focused row to another (type, category) section, appending it to
  // the end of that bucket. Optimistic + immediate save (a discrete pick, not
  // typing); revert on error like onMove/onDelete.
  const editSection = useCallback(
    (itemId: string, type: BalanceType, category: BalanceCategory) => {
      const target = items.find((it) => it.id === itemId);
      if (!target) return;
      if (target.type === type && target.category === category) return;

      const previous = items;
      const maxSort = items.reduce(
        (max, it) =>
          it.type === type && it.category === category && it.sortOrder > max
            ? it.sortOrder
            : max,
        0,
      );
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, type, category, sortOrder: maxSort + 1 }
            : it,
        ),
      );
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          const updated = await setBalanceItemSection({
            itemId,
            type,
            category,
          });
          setItems((prev) =>
            prev.map((it) =>
              it.id === updated.id
                ? {
                    ...it,
                    type: updated.type,
                    category: updated.category,
                    sortOrder: updated.sortOrder,
                  }
                : it,
            ),
          );
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
    [items],
  );

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
        MEDIUM_TERM: { rows: [], subtotal: 0 },
        LONG_TERM: { rows: [], subtotal: 0 },
        PROPERTY: { rows: [], subtotal: 0 },
        OTHER: { rows: [], subtotal: 0 },
      },
      LIABILITY: {
        CURRENT: { rows: [], subtotal: 0 },
        MEDIUM_TERM: { rows: [], subtotal: 0 },
        LONG_TERM: { rows: [], subtotal: 0 },
        PROPERTY: { rows: [], subtotal: 0 },
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
      role="row"
      onMouseDown={() => setFocusedCell({ itemId: item.id, field: "label" })}
    >
      <SheetCell
        role="rowheader"
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
          currency={currency}
          value={item.value}
          numberFormat={numberFormat}
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
      <SectionRow role="row">
        <SheetCell role="rowheader">{label}</SheetCell>
        <SheetCell align="right">{fmtAmount(total)}</SheetCell>
        <SheetCell />
      </SectionRow>
      {CATEGORIES.filter(
        (c) => !(type === "LIABILITY" && c.key === "PROPERTY"),
      ).map((c) => {
        const bucket = groups[type][c.key];
        const help = CATEGORY_HELP[type][c.key];
        return (
          <div key={`${type}-${c.key}`}>
            <SubheadRow role="row">
              <SheetCell role="rowheader">
                <SubheadLabel>
                  {c.label}
                  <InfoButton
                    type="button"
                    data-info-root
                    aria-label={`What goes in ${help.title}?`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpenInfo((cur) =>
                        cur?.title === help.title
                          ? null
                          : {
                              title: help.title,
                              body: help.body,
                              top: r.bottom + 6,
                              left: Math.min(r.left, window.innerWidth - 296),
                            },
                      );
                    }}
                  >
                    i
                  </InfoButton>
                </SubheadLabel>
              </SheetCell>
              <SheetCell align="right">{fmtAmount(bucket.subtotal)}</SheetCell>
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
        title={
          <>
            Balance Sheet · <PeriodLabel>{periodState.label}</PeriodLabel>
          </>
        }
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
          <CopyWrapper ref={copyWrapperRef}>
            <ToolbarTool
              onClick={() => (copyOpen ? setCopyOpen(false) : openCopy())}
              aria-expanded={copyOpen}
            >
              ⧉ Copy from…
            </ToolbarTool>
            {copyOpen && (
              <CopyPopover aria-label="Copy from another month">
                <CopyTitle>Copy into {periodState.label}</CopyTitle>
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
                      Every asset & liability line copies over, values included.
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
                        {copyBusy ? "Copying…" : "Copy"}
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
              ⤓ Save as template
            </ToolbarTool>
            {saveTplOpen && (
              <CopyPopover aria-label="Save this month as your balance template">
                <CopyTitle>Save as balance template</CopyTitle>
                <CopyConfirmText>
                  {templateExists
                    ? "Replaces your current balance template. "
                    : ""}
                  Saves this month's asset & liability lines as your reusable
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
        {focusedItem && (
          <ToolbarGroup>
            <SectionSelect
              aria-label="Move to section"
              value={`${focusedItem.type}:${focusedItem.category}`}
              onChange={(e) => {
                const next = SECTIONS.find((s) => s.value === e.target.value);
                if (next) editSection(focusedItem.id, next.type, next.category);
              }}
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SectionSelect>
          </ToolbarGroup>
        )}
        <ToolbarGroup>
          <ToolbarTool onClick={onDelete} disabled={!focusedCell}>
            × Delete
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
      </Toolbar>
      <Sheet data-sheet-scroller role="table" aria-label="Balance sheet">
        {renderSection("ASSET", "Assets", assetsTotal)}
        {renderSection("LIABILITY", "Liabilities", liabilitiesTotal)}
        <GrandRow role="row">
          <SheetCell role="rowheader">Net worth</SheetCell>
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
            {fmtAmount(netWorth)}
          </SheetCell>
          <SheetCell />
        </GrandRow>
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

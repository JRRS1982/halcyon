"use client";

import Link from "next/link";
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
import { AddAccountDrawer } from "@/app/(app)/balance/AddAccountDrawer";
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
  type AnchorAccount,
  anchorPickerEmptyReason,
  anchorTargetLabel,
  eligibleAnchorAccounts,
  rowsInSection,
  rowsOfType,
  skippedRowsNotice,
  transferRowLabel,
} from "@/lib/budget/sections";
import {
  computeRollups,
  type ItemAmounts,
  sumAmounts,
  surplus,
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
  copyPeriodFrom,
  createItemForMonth,
  deleteItem,
  listCopyablePeriods,
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
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  category: ExpenseCategory | null;
  incomeCategory: IncomeCategory | null;
  categoryId: string | null;
  // The anchor a TRANSFER/REPAYMENT hangs on: the account the money moves to
  // or from, and (TRANSFER only) which way, relative to that account. Null on
  // the category-keyed kinds. Both must survive the trip from the server —
  // a row that arrives without its direction is silently read as an inflow.
  accountId: string | null;
  direction: "INFLOW" | "OUTFLOW" | null;
  label: string;
  budget: number;
  actual: number;
  sortOrder: number;
};

type FocusedCell = {
  itemId: string;
  field: "label" | "budget" | "actual";
} | null;

// What the Add drawer knows about a new anchored row. The label defaults to
// the account's name and stays editable, as a category row's does.
type NewRowAnchor = {
  accountId: string;
  direction: "INFLOW" | "OUTFLOW" | null;
  label: string;
};

// The two kinds that target an account, and so need a picker before the row
// can exist. Income and Expense are added outright.
type AnchoredKind = "TRANSFER" | "REPAYMENT";

// Every kind the Add drawer builds. Income and Expense come first because they
// are the ordinary ones.
type AddKind = "INCOME" | "EXPENSE" | AnchoredKind;

// The drawer's first level. Repayment is not here: it renders inside Expenses
// on the sheet, so it is offered as one of Expense's sections rather than as a
// kind of its own.
const ADD_KINDS = ["INCOME", "EXPENSE", "TRANSFER"] as const;

const isAnchoredKind = (kind: AddKind): kind is AnchoredKind =>
  kind === "TRANSFER" || kind === "REPAYMENT";

const ADD_KIND_LABEL = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  REPAYMENT: "Debt payment",
} as const satisfies Record<AddKind, string>;

// Expense's second level: the sheet's three expense sections, plus Repayment.
// The three plain ones add a row outright — the section IS the answer, so
// asking for a second click on Add would be asking nothing.
const EXPENSE_SECTIONS = [
  { key: "FIXED", label: "Fixed" },
  { key: "VARIABLE", label: "Variable" },
  { key: "DISCRETIONARY", label: "Discretionary" },
] as const;

const ANCHORED_KIND_COPY = {
  TRANSFER: {
    title: "Transfer to an account",
    noun: "asset",
    // Reads into the empty-state sentence below. A transfer can go either
    // way, so it is "to or from", not just "to".
    purpose: "to transfer to or from",
  },
  REPAYMENT: {
    title: "Repay a debt",
    noun: "liability",
    purpose: "to repay",
  },
} as const satisfies Record<
  AnchoredKind,
  { title: string; noun: string; purpose: string }
>;

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

// An anchored row's label cell: the editable name, then the account it points
// at. The target is not editable — it is what the row IS — so it sits beside
// the input rather than inside it.
const RowLabel = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-width: 0;
`;

const RowTarget = styled.span`
  ${({ theme }) => `
    flex: none;
    color: ${theme.colors.dim};
    font-family: ${theme.typography.bodyMd.family};
    font-size: 12px;
    white-space: nowrap;
  `}
`;

// A quiet line under the toolbar for something the user should know but that
// isn't a failure — a copy that left rows behind, say.
const SheetNotice = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.spacing.md};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.body};
  `}
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
  /* Matches ToolbarGroup's own gap, so wrapping two tools together doesn't
     bunch them tighter than their neighbours. */
  gap: ${({ theme }) => theme.spacing.xs};
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

// The drawer asks two questions in sequence — the kind, then what that kind
// needs. Styled like CopyTitle, the second one reads as another top-level
// heading and the list under it looks like a sibling of the kind buttons
// rather than the answer to the choice above. Smaller, muted, and separated
// by a rule from the group it follows.
const CopySubTitle = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMd.family};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: ${theme.colors.bodyMuted};
    padding-top: ${theme.spacing.md};
    margin-top: ${theme.spacing.xs};
    margin-bottom: ${theme.spacing.xs};
    border-top: 1px solid ${theme.colors.hairline};
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

// Repayments are a bucket inside Expenses rather than a section of their own:
// the money left, so it is spending, and a mortgage is the first thing people
// look for under Expenses.
// A link-looking button inside the empty state, so "add one now" reads as part
// of the sentence rather than as another control.
const LinkBtn = styled.button`
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
  cursor: pointer;
`;

const REPAYMENTS_HELP =
  "Money paid at a debt you owe — a mortgage, a loan, a credit card. It counts as spending here because it left your account; the plan works out how much of it cleared the debt.";

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
  accounts,
  year,
  month,
  currency,
  numberFormat,
  actualsReadOnly = false,
}: {
  period: SerializedPeriod;
  initialItems: SerializedItem[];
  // Every account the user has, archived ones included: the archived ones can
  // still name an existing row's target, but eligibleAnchorAccounts never
  // offers them as a new row's.
  accounts: AnchorAccount[];
  year: number;
  month: number;
  currency: string;
  numberFormat: NumberFormat;
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
  // What a copy left behind. Not an error — the rows were skipped on purpose,
  // because their anchor account is gone — but the user is owed the count.
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

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

  // Overwrite the current month with a copy of the selected month.
  const confirmCopy = useCallback(() => {
    if (!copySelectedId) return;
    setCopyBusy(true);
    setCopyNotice(null);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        const result = await copyPeriodFrom({
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
        // A row whose anchor account has been archived, deleted or re-kinded
        // is skipped rather than copied malformed. Saying so is the whole
        // difference between a deliberate omission and rows that vanished.
        setCopyNotice(skippedRowsNotice(result.skipped));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Copy failed");
      } finally {
        setCopyBusy(false);
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    });
  }, [copySelectedId, year, month]);

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
    (
      type: SerializedItem["type"],
      anchor?: NewRowAnchor,
      section?: {
        category?: ExpenseCategory;
        incomeCategory?: IncomeCategory;
      },
    ) => {
      startTransition(async () => {
        pendingSavesRef.current += 1;
        setPendingCount(pendingSavesRef.current);
        try {
          // The period row is created lazily, with the first item that needs
          // it — one action, so a month can never end up with a period and no
          // rows. Once it exists, subsequent adds reuse the id it returns.
          //
          // The anchor is spread in only for the kinds that have one: zod
          // rejects an accountId on an INCOME/EXPENSE row, so an explicit
          // null would be a rejected write rather than an absent field.
          const { periodId, item: created } = await createItemForMonth({
            year,
            month,
            type,
            label: anchor?.label ?? "",
            ...(section?.category && { category: section.category }),
            ...(section?.incomeCategory && {
              incomeCategory: section.incomeCategory,
            }),
            ...(anchor && {
              accountId: anchor.accountId,
              direction: anchor.direction,
            }),
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
              accountId: created.accountId ?? null,
              direction: created.direction ?? null,
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

  // ─── Add drawer for the anchored kinds ────────────────────────────────────

  const [addOpen, setAddOpen] = useState(false);
  // Defaults to EXPENSE: it is what people add most.
  const [addKind, setAddKind] = useState<AddKind>("EXPENSE");
  const [addAccountId, setAddAccountId] = useState<string | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  // INFLOW by default: saving into an account is the ordinary case, and
  // raiding one is the deliberate act.
  const [addDirection, setAddDirection] = useState<"INFLOW" | "OUTFLOW">(
    "INFLOW",
  );
  const addWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        addWrapperRef.current &&
        !addWrapperRef.current.contains(e.target as Node)
      ) {
        setAddOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [addOpen]);

  const toggleAddDrawer = useCallback(() => {
    setAddAccountId(null);
    setAddDirection("INFLOW");
    setAddOpen((open) => !open);
  }, []);

  // Switching kind clears the account chosen for the previous one — the
  // candidate list differs per kind, so a carried-over id could name an
  // account this kind may not target.
  const chooseAddKind = useCallback((kind: AddKind) => {
    setAddKind(kind);
    setAddAccountId(null);
  }, []);

  // Choosing a section IS the add: an income or expense needs nothing else, so
  // a second click on a confirm button would be asking a question already
  // answered.
  const addInSection = useCallback(
    (section: {
      category?: ExpenseCategory;
      incomeCategory?: IncomeCategory;
    }) => {
      onAddRow(
        section.incomeCategory ? "INCOME" : "EXPENSE",
        undefined,
        section,
      );
      setAddOpen(false);
    },
    [onAddRow],
  );

  // The accounts this month's live rows already point at. One account carries
  // at most one row per period — see eligibleAnchorAccounts.
  const anchoredAccountIds = useMemo(
    () => items.flatMap((i) => (i.accountId === null ? [] : [i.accountId])),
    [items],
  );

  // Only the accounts this kind may target, minus the ones already spoken for.
  // Empty is an ordinary state, not an error: every account seeded at
  // onboarding is kind NONE.
  const addCandidates = useMemo(
    () =>
      isAnchoredKind(addKind)
        ? eligibleAnchorAccounts(addKind, accounts, anchoredAccountIds)
        : [],
    [addKind, accounts, anchoredAccountIds],
  );
  const addAccount = useMemo(
    () => addCandidates.find((a) => a.id === addAccountId) ?? null,
    [addCandidates, addAccountId],
  );
  const addEmptyReason = useMemo(
    () =>
      isAnchoredKind(addKind)
        ? anchorPickerEmptyReason(addKind, accounts, anchoredAccountIds)
        : null,
    [addKind, accounts, anchoredAccountIds],
  );

  // Only the anchored kinds reach this: an income or expense is added by
  // clicking its section, which answers everything the row needs.
  const confirmAdd = useCallback(() => {
    if (!isAnchoredKind(addKind) || !addAccount) return;
    onAddRow(addKind, {
      accountId: addAccount.id,
      // A repayment is always money at the debt, so it carries no direction.
      direction: addKind === "TRANSFER" ? addDirection : null,
      label: addAccount.name,
    });
    setAddOpen(false);
  }, [addKind, addAccount, addDirection, onAddRow]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const rollups = useMemo(() => computeRollups(items), [items]);

  // Names for the accounts rows point at, archived ones included — a row keeps
  // naming where its money went after the account leaves the picker.
  const accountNames = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  // Expenses grouped into their three category buckets, each with its rows and
  // a bucket subtotal.
  const expenseBuckets = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((cat) => {
        const rows = buildSectionOrder(items, "EXPENSE", cat.key);
        return { cat, rows, totals: sumAmounts(rows, rollups) };
      }),
    [items, rollups],
  );

  // Income grouped into the five income buckets, same shape as expenseBuckets.
  const incomeBuckets = useMemo(
    () =>
      INCOME_CATEGORIES.map((cat) => {
        const rows = buildSectionOrder(items, "INCOME", cat.key);
        return { cat, rows, totals: sumAmounts(rows, rollups) };
      }),
    [items, rollups],
  );

  // Repayments are a bucket inside Expenses — that is where people look for a
  // mortgage, and the money genuinely left, so it belongs in that total.
  const repaymentRows = useMemo(() => rowsOfType(items, "REPAYMENT"), [items]);
  const repaymentTotals = useMemo(
    () => sumAmounts(repaymentRows, rollups),
    [repaymentRows, rollups],
  );

  const transferRows = useMemo(
    () => rowsInSection(items, "TRANSFERS"),
    [items],
  );

  // Section totals span whichever kinds render there, so Expenses includes
  // repayments without either kind knowing about the other.
  const incomeTotals = useMemo(
    () => sumAmounts(rowsInSection(items, "INCOME"), rollups),
    [items, rollups],
  );
  const expenseTotals = useMemo(
    () => sumAmounts(rowsInSection(items, "EXPENSES"), rollups),
    [items, rollups],
  );
  const transferTotals = useMemo(
    () => sumAmounts(transferRows, rollups),
    [transferRows, rollups],
  );

  // What is left over, which is no longer income minus expenses: a transfer
  // moves money without spending it, so it shifts the bottom line by
  // direction. See surplus() for why INFLOW subtracts.
  const leftOver = useMemo(
    () => ({
      budget: surplus(items, "budget"),
      actual: surplus(items, "actual"),
    }),
    [items],
  );

  // The focused row, if any — drives the category dropdown and delete button.
  const focusedItem = useMemo(
    () =>
      focusedCell
        ? (items.find((i) => i.id === focusedCell.itemId) ?? null)
        : null,
    [focusedCell, items],
  );

  // Item ids in the order they're rendered (income buckets, expense buckets,
  // repayments, then transfers), so Enter can step to the next row down.
  const orderedItemIds = useMemo(
    () =>
      [
        ...incomeBuckets.flatMap((b) => b.rows),
        ...expenseBuckets.flatMap((b) => b.rows),
        ...repaymentRows,
        ...transferRows,
      ].map((it) => it.id),
    [incomeBuckets, expenseBuckets, repaymentRows, transferRows],
  );

  // The bucket a row sits in, so Enter on the last row of one can add another
  // there rather than falling into the next bucket.
  const bucketOf = useCallback(
    (itemId: string) => {
      for (const b of incomeBuckets) {
        const last = b.rows[b.rows.length - 1];
        if (last?.id === itemId) {
          return { type: "INCOME" as const, incomeCategory: b.cat.key };
        }
      }
      for (const b of expenseBuckets) {
        const last = b.rows[b.rows.length - 1];
        if (last?.id === itemId) {
          return { type: "EXPENSE" as const, category: b.cat.key };
        }
      }
      return null;
    },
    [incomeBuckets, expenseBuckets],
  );

  // Enter moves focus to the same field one row down, matching the header's
  // "Enter drops down" — except on the last row of an income or expense
  // bucket, where it adds another row to that bucket and lands in its label.
  // That is the flow of typing a list out: the row you want next is the one
  // below the one you just filled in.
  //
  // Anchored rows (transfers, repayments) are left alone: they cannot exist
  // without an account, so there is nothing useful for Enter to create.
  const onCellKeyDown = useCallback(
    (
      itemId: string,
      field: "label" | "budget" | "actual",
    ): KeyboardEventHandler<HTMLInputElement> =>
      (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        // The bucket check comes first: "last row" means last of its own
        // section, not last of the whole sheet. Ordering these the other way
        // round only ever added on the very final row of the page.
        const bucket = bucketOf(itemId);
        if (bucket) {
          const { type, ...section } = bucket;
          onAddRow(type, undefined, section);
          return;
        }
        const idx = orderedItemIds.indexOf(itemId);
        const nextId = orderedItemIds[idx + 1];
        if (nextId) cellRefs.current.get(`${nextId}:${field}`)?.focus();
      },
    [orderedItemIds, bucketOf, onAddRow],
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

  // Drop a row nobody typed into.
  //
  // Enter hands you a fresh row; changing your mind should not leave an empty
  // one behind. "Untouched" is deliberately strict — no label AND nothing in
  // either amount — because a NAMED row budgeted at zero is a real answer: it
  // exists, it reaches the plan, and there may be contributions to it later.
  // Treating an empty amount as "delete me" would take those with it.
  //
  // Anchored rows are exempt: a transfer or repayment names an account even
  // when its label is blank, so it is never untouched in the sense meant here.
  const removeIfUntouched = useCallback(
    (itemId: string) => {
      const row = items.find((it) => it.id === itemId);
      if (!row) return;
      if (row.accountId !== null) return;
      if (row.label.trim() !== "") return;
      if (row.budget !== 0 || row.actual !== 0) return;

      setItems((prev) => prev.filter((it) => it.id !== itemId));
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      void (async () => {
        try {
          await deleteItem({ itemId });
          setLastSavedAt(new Date());
        } catch {
          // Losing an empty row is not worth an error banner; the next render
          // from the server puts it back if the delete failed.
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingCount(pendingSavesRef.current);
        }
      })();
    },
    [items],
  );

  // Focus leaving a row is what "blur" means here — moving between that row's
  // own cells is not leaving it. Tracked centrally rather than plumbed through
  // every cell's onBlur, which would fire on each Tab within a row.
  const lastFocusedItemRef = useRef<string | null>(null);
  useEffect(() => {
    const current = focusedCell?.itemId ?? null;
    const previous = lastFocusedItemRef.current;
    lastFocusedItemRef.current = current;
    if (previous && previous !== current) removeIfUntouched(previous);
  }, [focusedCell, removeIfUntouched]);

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

  // The bucket header inside a section: its name, an info popover, and its
  // subtotal. Shared by all three sections' buckets.
  const renderBucketSubhead = (
    label: string,
    help: string,
    totals: ItemAmounts,
  ) => (
    <SheetSubheadRow
      label={
        <SubheadLabel>
          {label}
          <InfoButton
            type="button"
            data-info-root
            aria-label={`What goes in ${label}?`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setOpenInfo((prevInfo) =>
                prevInfo?.title === label
                  ? null
                  : {
                      title: label,
                      body: help,
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
  );

  const renderItemRow = (item: SerializedItem) => {
    // What an anchored row points at, said from the user's side: "To Vanguard
    // ISA", never the stored INFLOW.
    const accountName = item.accountId
      ? accountNames.get(item.accountId)
      : undefined;
    const target = accountName
      ? anchorTargetLabel(item.type, item.direction, accountName)
      : null;
    const labelInput = (
      <CellInput
        ref={registerCell(`${item.id}:label`)}
        value={item.label}
        placeholder="Name this row"
        onChange={(e) => editField(item.id, { label: e.target.value })}
        onKeyDown={onCellKeyDown(item.id, "label")}
        onFocus={() => setFocusedCell({ itemId: item.id, field: "label" })}
      />
    );

    return (
      <SheetItemRow
        key={item.id}
        depth={1}
        variant="default"
        onSelect={() => setFocusedCell({ itemId: item.id, field: "label" })}
        label={
          target ? (
            <RowLabel>
              {labelInput}
              <RowTarget>{target}</RowTarget>
            </RowLabel>
          ) : (
            labelInput
          )
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
            elsewhere is a month-level operation, so it sits after it. */}
        <ToolbarGroup>
          {/* One button for all four kinds, matching the balance sheet: the
              kind is the drawer's first field rather than four toolbar
              buttons. Income and Expense add a row outright; Transfer and
              Repayment must name the account they target first. */}
          <CopyWrapper ref={addWrapperRef}>
            <ToolbarTool onClick={toggleAddDrawer} aria-expanded={addOpen}>
              + Add
            </ToolbarTool>
            {addOpen && (
              <CopyPopover aria-label="Add a budget row">
                <CopyTitle>Add a row</CopyTitle>
                <CopyList>
                  {ADD_KINDS.map((kind) => (
                    <CopySource
                      key={kind}
                      type="button"
                      $selected={kind === addKind}
                      onClick={() => chooseAddKind(kind)}
                    >
                      {ADD_KIND_LABEL[kind]}
                    </CopySource>
                  ))}
                </CopyList>
                {addKind === "INCOME" && (
                  <>
                    <CopySubTitle>Which section?</CopySubTitle>
                    <CopyList>
                      {INCOME_CATEGORIES.map((c) => (
                        <CopySource
                          key={c.key}
                          type="button"
                          onClick={() =>
                            addInSection({ incomeCategory: c.key })
                          }
                        >
                          {c.label}
                        </CopySource>
                      ))}
                    </CopyList>
                  </>
                )}
                {(addKind === "EXPENSE" || addKind === "REPAYMENT") && (
                  <>
                    <CopySubTitle>Which section?</CopySubTitle>
                    <CopyList>
                      {EXPENSE_SECTIONS.map((c) => (
                        <CopySource
                          key={c.key}
                          type="button"
                          onClick={() => addInSection({ category: c.key })}
                        >
                          {c.label}
                        </CopySource>
                      ))}
                      <CopySource
                        type="button"
                        $selected={addKind === "REPAYMENT"}
                        onClick={() => chooseAddKind("REPAYMENT")}
                      >
                        Repayment
                      </CopySource>
                    </CopyList>
                  </>
                )}
                {isAnchoredKind(addKind) &&
                  (addEmptyReason === "ALL_TAKEN" ? (
                    <CopyMuted>
                      Every {ANCHORED_KIND_COPY[addKind].noun} account you have
                      already has a row this month — one account carries one row
                      per period. Edit that row, or delete it to start again.
                    </CopyMuted>
                  ) : addEmptyReason === "NO_ACCOUNTS" ? (
                    <CopyMuted>
                      You have no {ANCHORED_KIND_COPY[addKind].noun} accounts{" "}
                      {ANCHORED_KIND_COPY[addKind].purpose} yet.{" "}
                      <LinkBtn
                        type="button"
                        onClick={() => setNewAccountOpen(true)}
                      >
                        Add one now
                      </LinkBtn>
                      , or from the <Link href="/balance">balance sheet</Link>.
                    </CopyMuted>
                  ) : (
                    <>
                      <CopySubTitle>
                        {ANCHORED_KIND_COPY[addKind].title}
                      </CopySubTitle>
                      <CopyList>
                        {addCandidates.map((account) => (
                          <CopySource
                            key={account.id}
                            type="button"
                            $selected={account.id === addAccountId}
                            onClick={() => setAddAccountId(account.id)}
                          >
                            {account.name}
                          </CopySource>
                        ))}
                        {/* The account you want may not exist yet, and
                            leaving to the balance sheet to make one loses the
                            row you were part-way through adding. Same drawer
                            the balance sheet uses. */}
                        <CopySource
                          type="button"
                          onClick={() => setNewAccountOpen(true)}
                        >
                          + New account…
                        </CopySource>
                      </CopyList>
                      {addKind === "TRANSFER" && addAccount && (
                        <CopyConfirm>
                          {/* Never INFLOW/OUTFLOW: the stored direction is
                              relative to the account, and money "into" your ISA
                              is money out of your pocket. */}
                          <CopyList>
                            {(["INFLOW", "OUTFLOW"] as const).map(
                              (direction) => (
                                <CopySource
                                  key={direction}
                                  type="button"
                                  $selected={direction === addDirection}
                                  onClick={() => setAddDirection(direction)}
                                >
                                  {transferRowLabel(direction, addAccount.name)}
                                </CopySource>
                              ),
                            )}
                          </CopyList>
                        </CopyConfirm>
                      )}
                    </>
                  ))}
                <CopyActions>
                  <CopyButton type="button" onClick={() => setAddOpen(false)}>
                    Cancel
                  </CopyButton>
                  {/* Only the anchored kinds get this far: an income or
                      expense was already added by the section click. */}
                  {isAnchoredKind(addKind) && (
                    <CopyButton
                      type="button"
                      $primary
                      onClick={confirmAdd}
                      disabled={!addAccount}
                    >
                      Add
                    </CopyButton>
                  )}
                </CopyActions>
              </CopyPopover>
            )}
          </CopyWrapper>
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
                ) : copyList.length === 0 ? (
                  <CopyMuted>No other months to copy from yet.</CopyMuted>
                ) : (
                  <CopyList>
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
        </ToolbarGroup>
        <AddAccountDrawer
          open={newAccountOpen}
          year={year}
          month={month}
          onClose={() => setNewAccountOpen(false)}
          onCreated={({
            accountId,
          }: {
            periodId: string;
            accountId: string;
          }) => {
            setNewAccountOpen(false);
            // Select it straight away when this kind can target it; the refresh
            // brings it into `accounts`, and the picker reads from there.
            setAddAccountId(accountId);
            router.refresh();
          }}
        />
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

      {copyNotice && <SheetNotice role="status">{copyNotice}</SheetNotice>}

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
            {renderBucketSubhead(cat.label, cat.help, totals)}
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
            {renderBucketSubhead(cat.label, cat.help, totals)}
            {rows.map((item) => renderItemRow(item))}
          </div>
        ))}
        <div>
          {renderBucketSubhead(
            "Debt payments",
            REPAYMENTS_HELP,
            repaymentTotals,
          )}
          {repaymentRows.map((item) => renderItemRow(item))}
        </div>

        <SheetSectionRow
          label="Transfers and saving"
          amounts={{
            budget: fmtAmount(transferTotals.budget),
            actual: fmtAmount(transferTotals.actual),
          }}
        />
        {transferRows.map((item) => renderItemRow(item))}

        <SheetGrandRow
          label="Left over"
          amounts={{
            budget: fmtSigned(leftOver.budget),
            actual: fmtSigned(leftOver.actual),
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

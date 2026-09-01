"use client";

import type { AccountKind, AccountSection } from "@prisma/client";
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
import { Sheet } from "@/components/sheet/Sheet";
import { SheetCell } from "@/components/sheet/SheetCell";
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
  type AccountTypeId,
  accountTypesOfKind,
} from "@/lib/accounts/accountDraft";
import { isPropertyRow } from "@/lib/accounts/deletion";
import type { AccountDeletionCounts } from "@/lib/accounts/schemas";
import { BUCKET_ORDER, isValidBalanceCategory } from "@/lib/balance/reorder";
import {
  formatYm,
  MONTH_LABELS_SHORT,
  nextMonth,
  previousMonth,
} from "@/lib/budget/period";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  formatAmount,
  NUMBER_FORMAT_SPEC,
  type NumberFormat,
} from "@/lib/settings/currency";
import { AddAccountDrawer } from "./AddAccountDrawer";
import {
  accountDeletionCounts,
  renameAccount,
  setAccountSection,
  setAccountType,
} from "./accountActions";
import {
  clearBalanceValue,
  copyBalancePeriodFrom,
  listCopyableBalancePeriods,
  upsertBalanceValue,
} from "./actions";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SerializedPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

// One row per account the user owns or owes, with this month's observation
// left-joined on (see page.tsx). The account is the durable thing; `value`,
// `notes` and `carriedOver` describe the month, and are null/false for an
// account that has recorded nothing this month.
export type SerializedAccountRow = {
  accountId: string;
  name: string;
  type: AccountTypeId;
  // Derived from `type` via kindOf — never the stored Account.kind mirror.
  kind: AccountKind;
  section: AccountSection;
  sortOrder: number;
  // Null when this month holds no observation for the account: the cell is
  // blank, and the row is counted in the "without a value" note.
  value: number | null;
  notes: string | null;
  // Cloned by copy-from and not yet confirmed by a value edit — the number is
  // last month's, shown dimmed until the user touches it.
  carriedOver: boolean;
};

type FocusedCell = {
  accountId: string;
  field: "label" | "value" | "notes";
} | null;

// The three category buckets shown under each section. Rendered always —
// even when empty — so the user can see where to add a row.
const CATEGORIES: { key: AccountSection; label: string }[] = [
  { key: "CURRENT", label: "Current" },
  { key: "MEDIUM_TERM", label: "Medium-term" },
  { key: "LONG_TERM", label: "Long-term" },
  { key: "PROPERTY", label: "Property" },
  { key: "OTHER", label: "Other" },
];

// The sections the toolbar's "move to section" dropdown offers for a row.
// Only the section moves — an account cannot cross between assets and
// liabilities (setAccountType refuses it), so the row's own kind fixes which
// destinations exist.
const sectionOptionsFor = (kind: AccountKind) =>
  CATEGORIES.filter((c) => isValidBalanceCategory(kind, c.key));

// Guidance shown in the per-subhead info popover. Plain-English, UK-flavoured
// examples — "what should go in this bucket". Edit freely; this is the only
// source of the help text.
const CATEGORY_HELP: Record<
  AccountKind,
  Record<AccountSection, { title: string; body: string }>
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

// Shown while any row still holds a copied-forward value, so the dimmed
// numbers read as "provisional" rather than "styling".
const CarriedNote = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

// The sheet's one error slot: whatever the server said, verbatim. A refused
// type change names the linked account or plan event blocking it, and that
// sentence is the only thing that tells the user what to do next.
const SheetError = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;

// Under the net-worth row: how many accounts are still waiting for this
// month's number. An empty cell is easy to scroll past; a count is not.
const MissingNote = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

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

  /* A cell that is waiting on something else (the notes cell of a row with
     no value yet). It stays in place and readable rather than greying out —
     only the cursor says it isn't ready. */
  &:disabled {
    cursor: not-allowed;
    color: ${({ theme }) => theme.colors.dim};
    -webkit-text-fill-color: ${({ theme }) => theme.colors.dim};
  }
`;

// Same pattern as /budget's AmountInput — raw editable string while focused,
// formatted per the user's number format when not. A null value is an account
// with nothing recorded this month: the cell renders empty rather than as a
// zero the user never typed, and emptying it commits null again (which clears
// the month's row) rather than writing 0.
function AmountInput({
  value,
  currency,
  numberFormat,
  onCommit,
  onFocus,
}: {
  value: number | null;
  currency: string;
  numberFormat: NumberFormat;
  onCommit: (n: number | null) => void;
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
    : value === null
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
        setDraft(value === null ? "" : String(value));
        onFocus();
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next === "") {
          onCommit(null);
          return;
        }
        const n = Number.parseFloat(next);
        if (Number.isFinite(n) && n >= 0) onCommit(n);
      }}
      onBlur={() => {
        setFocused(false);
        if (draft.trim() === "") {
          if (value !== null) onCommit(null);
          return;
        }
        const n = Number.parseFloat(draft);
        const final = Number.isFinite(n) && n >= 0 ? n : 0;
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
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile.
     The sheet is the widest thing on the page, so those 16px are the
     difference between the Actual column landing on screen and off it. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
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

// Centers the DeleteAccountPanel over the sheet — a row's delete control can
// be scrolled out of view by the time its counts have loaded, so the panel
// floats rather than rendering inline where the row was.
const DeleteScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: rgba(15, 17, 22, 0.22);
`;

const DeleteModal = styled.div`
  width: min(480px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.canvas};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 24px 64px rgba(15, 17, 22, 0.22);
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

export function BalanceSheet({
  period,
  initialRows,
  year,
  month,
  currency,
  numberFormat,
}: {
  period: SerializedPeriod;
  initialRows: SerializedAccountRow[];
  year: number;
  month: number;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const periodYear = year;
  const periodMonth = month;
  const fmtAmount = (n: number) => formatAmount(currency, n, numberFormat);

  const [periodState, setPeriodState] = useState(period);
  const [rows, setRows] = useState(initialRows);
  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);
  const pendingSavesRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  // Holds a key per edit that has been applied locally (editField, below) but
  // not yet started sending — a window pendingSavesRef does not cover, since
  // useDebouncedCallback delays 500ms per key before the save ever runs for
  // it. Per-key because the debounce is: editing cell A then cell B within the
  // same 500ms window must not let A's timer firing (and clearing A's own
  // entry) look like "nothing is dirty" while B's edit is still only sitting
  // in its own, separately-keyed timer. The name and the value are separate
  // keys per account because they now go to two different actions
  // (renameAccount, upsertBalanceValue) on two independent timers. Each key
  // hands over from this set to pendingSavesRef at the save's first line,
  // rather than overlapping or gapping.
  const dirtyItemsRef = useRef<Set<string>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  // Adopt fresh server data whenever the page re-renders with the same
  // (year, month) — a router.refresh() after a mutation the drawer made,
  // whose result carries only { periodId, accountId } and not the row(s) it
  // created. Mirrors transactions/Ledger.tsx's identical "adopt on refresh"
  // effect, but — unlike Ledger — a cell edit here can be unconfirmed when a
  // refresh lands: optimistically applied to `rows` (editField) but not yet
  // persisted, either still sitting in debouncedUpdate's 500ms timer
  // (dirtyItemsRef) or already sent and awaiting the server (pendingSavesRef).
  // Adoption is skipped while either is non-empty/non-zero: otherwise the server's
  // pre-write snapshot would silently overwrite the optimistic edit still
  // showing on screen (the write itself still lands in the DB — only the
  // display would be wrong, with nothing to correct it).
  // Refs, not state — reading them inline here (rather than via a helper
  // function) keeps both effects' dependency lists honest: a plain function
  // recreated every render would otherwise show up as a missing dependency.
  const pendingAdoptRef = useRef(false);
  useEffect(() => {
    if (dirtyItemsRef.current.size > 0 || pendingSavesRef.current > 0) {
      pendingAdoptRef.current = true;
      return;
    }
    setRows(initialRows);
  }, [initialRows]);
  useEffect(() => {
    if (dirtyItemsRef.current.size > 0 || pendingSavesRef.current > 0) {
      pendingAdoptRef.current = true;
      return;
    }
    setPeriodState(period);
  }, [period]);
  // A refresh deferred above because a write was in flight is never retried
  // on its own — nothing else re-requests it. Once the in-flight save
  // finishes (pendingCount back to 0), ask the server again so the drawer's
  // new row still shows up this session instead of staying invisible until
  // an unrelated navigation happens to remount the page.
  useEffect(() => {
    if (pendingCount === 0 && pendingAdoptRef.current) {
      pendingAdoptRef.current = false;
      router.refresh();
    }
  }, [pendingCount, router]);

  // The drawer only reports { periodId, accountId } — not the row(s) it
  // created (a mortgaged property is two) — so rather than guess their
  // shape, ask the server to re-render and adopt its answer via the effects
  // above. Setting periodState.id immediately (as the old add-row handler
  // did) keeps "Fill from…" usable before that refresh
  // lands.
  const onAccountCreated = useCallback(
    (result: { periodId: string; accountId: string }) => {
      if (!periodState.id) {
        setPeriodState((prev) => ({ ...prev, id: result.periodId }));
      }
      setLastSavedAt(new Date());
      setSaveError(null);
      router.refresh();
    },
    [periodState.id, router],
  );

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
  // month's.
  const confirmCopy = useCallback(() => {
    if (!copySelectedId) return;
    setCopyBusy(true);
    pendingSavesRef.current += 1;
    setPendingCount(pendingSavesRef.current);
    startTransition(async () => {
      try {
        const result = await copyBalancePeriodFrom({
          sourcePeriodId: copySelectedId,
          targetYear: year,
          targetMonth: month,
        });
        setPeriodState((prev) => ({ ...prev, id: result.periodId }));
        // The copy replaces this month's observations wholesale: every
        // account it carried takes the copied number, and every account it
        // didn't is back to having nothing recorded. The account rows
        // themselves don't move — only the month hanging off them. Notes
        // describe the source month's figure, not the target's, so a copy
        // never carries them over — the target starts with none.
        const copiedByAccountId = new Map(
          result.items.map((it) => [it.accountId, it]),
        );
        setRows((prev) =>
          prev.map((row) => {
            const copied = copiedByAccountId.get(row.accountId);
            if (!copied) {
              return { ...row, value: null, notes: null, carriedOver: false };
            }
            return {
              ...row,
              value: copied.value,
              notes: null,
              carriedOver: copied.carriedOver,
            };
          }),
        );
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

  // Tick "Saved Xs ago" every 5s.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // ─── Save plumbing ────────────────────────────────────────────────────────

  // Every save shares this bookkeeping: hand the dirty key over to
  // pendingSavesRef, run the action, and report the outcome. The message is
  // whatever the server said — a refused type change names the blocker, and
  // that sentence is the whole point of the refusal.
  const runSave = useCallback(
    async (dirtyKey: string | null, save: () => Promise<void>) => {
      // Removed here, at the same instant pendingSavesRef starts covering
      // this edit — not in `finally` — so the two refs hand over with no gap
      // (a refresh landing right here still sees a save in flight via
      // pendingSavesRef) and no double-counting (a re-edit typed while this
      // write is still in flight adds the key back to the set itself, below).
      // Only this key comes out — a different cell still mid-debounce keeps
      // the set non-empty, which is what stops the "adopt on refresh" effects
      // above from clobbering its still-unsaved value.
      if (dirtyKey) dirtyItemsRef.current.delete(dirtyKey);
      pendingSavesRef.current += 1;
      setPendingCount(pendingSavesRef.current);
      try {
        await save();
        setLastSavedAt(new Date());
        setSaveError(null);
        return true;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        setPendingCount(pendingSavesRef.current);
      }
    },
    [],
  );

  // The label names the account, so it saves through renameAccount — the
  // account is the thing being renamed, and the month's row only mirrors it.
  const performRename = useCallback(
    (accountId: string, name: string) =>
      runSave(`${accountId}:name`, () => renameAccount({ accountId, name })),
    [runSave],
  );

  // Value and notes share one debounce key, and the debounce keeps only the
  // latest call's arguments — so a value typed and then a note added inside
  // the same window would send the note alone and drop the value. Each edit
  // merges into the account's pending patch here instead; the save reads the
  // union and clears it, so nothing typed is ever left behind.
  const pendingValuePatchRef = useRef(
    new Map<string, { value?: number | null; notes?: string | null }>(),
  );

  // The value and the notes belong to (account, month), so they save through
  // upsertBalanceValue — which creates this month's row the first time the
  // user types in it. Emptying the cell removes the observation rather than
  // recording a zero.
  const performValueSave = useCallback(
    (accountId: string) => {
      const patch = pendingValuePatchRef.current.get(accountId) ?? {};
      pendingValuePatchRef.current.delete(accountId);
      return runSave(`${accountId}:value`, async () => {
        const { value, notes } = patch;
        if (value === null) {
          await clearBalanceValue({ accountId, year, month });
          return;
        }
        await upsertBalanceValue({
          accountId,
          year,
          month,
          ...(value !== undefined && { value }),
          ...(notes !== undefined && { notes }),
        });
      });
    },
    [runSave, year, month],
  );

  const debouncedRename = useDebouncedCallback(
    performRename,
    500,
    (accountId) => `${accountId}:name`,
  );
  const debouncedValueSave = useDebouncedCallback(
    performValueSave,
    500,
    (accountId) => `${accountId}:value`,
  );

  const editField = useCallback(
    (
      accountId: string,
      patch: { name?: string; value?: number | null; notes?: string | null },
    ) => {
      // Added synchronously, in the same tick as the optimistic setRows
      // below — this is the instant the edit becomes "unsaved", well before
      // the 500ms timer even starts the save.
      setRows((prev) =>
        prev.map((row) =>
          row.accountId === accountId
            ? {
                ...row,
                ...patch,
                // A value edit confirms a carried-over number as this month's;
                // mirrors the server's upsertBalanceValue. Clearing it leaves
                // nothing to be provisional about.
                ...(patch.value !== undefined && { carriedOver: false }),
                ...(patch.value === null && { notes: null }),
              }
            : row,
        ),
      );
      if (patch.name !== undefined) {
        dirtyItemsRef.current.add(`${accountId}:name`);
        debouncedRename(accountId, patch.name);
      }
      if (patch.value !== undefined || patch.notes !== undefined) {
        dirtyItemsRef.current.add(`${accountId}:value`);
        // Merged, not replaced: the pending patch is the union of every
        // value/notes edit made since the last save fired. Clearing the value
        // drops a pending note with it, matching the optimistic row above.
        const pending = pendingValuePatchRef.current.get(accountId) ?? {};
        pendingValuePatchRef.current.set(accountId, {
          ...(patch.value === null ? {} : pending),
          ...(patch.value !== undefined && { value: patch.value }),
          ...(patch.notes !== undefined && { notes: patch.notes }),
        });
        debouncedValueSave(accountId);
      }
    },
    [debouncedRename, debouncedValueSave],
  );

  // Every row is an account, so deleting one always opens the two-mode delete
  // panel rather than removing a line — soft-delete-by-default, and the one
  // hard delete in the app needs the size of what it removes stated up front.
  const [deletePanel, setDeletePanel] = useState<{
    accountId: string;
    name: string;
    isProperty: boolean;
    counts: AccountDeletionCounts;
  } | null>(null);
  const [deleteCountsLoading, setDeleteCountsLoading] = useState(false);

  const onDelete = useCallback(() => {
    if (!focusedCell) return;
    const row = rows.find((r) => r.accountId === focusedCell.accountId);
    if (!row) return;

    setDeleteCountsLoading(true);
    startTransition(async () => {
      try {
        const counts = await accountDeletionCounts({
          accountId: row.accountId,
        });
        setDeletePanel({
          accountId: row.accountId,
          name: row.name,
          isProperty: isPropertyRow(row.kind, row.section),
          counts,
        });
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "Couldn't load delete details",
        );
      } finally {
        setDeleteCountsLoading(false);
      }
    });
  }, [focusedCell, rows]);

  const closeDeletePanel = useCallback(() => setDeletePanel(null), []);

  const onDeleteDone = useCallback(() => {
    setDeletePanel(null);
    setFocusedCell(null);
    router.refresh();
  }, [router]);

  // The delete panel is an alertdialog over the sheet, so it gets the same
  // focus management as AddAccountDrawer.tsx's Sheet (itself adapted from
  // plan/PlanDrawer.tsx): Esc closes; Tab is trapped inside the modal; body
  // scroll is locked; focus moves into the modal on open and back to
  // whatever triggered it on close.
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const closeDeletePanelRef = useRef(closeDeletePanel);
  closeDeletePanelRef.current = closeDeletePanel;

  useEffect(() => {
    if (!deletePanel) return;
    const modal = deleteModalRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDeletePanelRef.current();
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const focusables = modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [deletePanel]);

  const focusedRow = useMemo(
    () =>
      focusedCell
        ? (rows.find((r) => r.accountId === focusedCell.accountId) ?? null)
        : null,
    [focusedCell, rows],
  );

  // Move the focused account into another section, appending it to the end of
  // that bucket. The section is a fact about the account, not about the month,
  // so it saves through setAccountSection. Optimistic + immediate save (a
  // discrete pick, not typing); revert on error.
  const editSection = useCallback(
    (accountId: string, section: AccountSection) => {
      const target = rows.find((r) => r.accountId === accountId);
      if (!target || target.section === section) return;

      const previous = rows;
      const maxSort = rows.reduce(
        (max, r) =>
          r.kind === target.kind && r.section === section && r.sortOrder > max
            ? r.sortOrder
            : max,
        0,
      );
      setRows((prev) =>
        prev.map((r) =>
          r.accountId === accountId
            ? { ...r, section, sortOrder: maxSort + 1 }
            : r,
        ),
      );
      startTransition(async () => {
        const saved = await runSave(null, () =>
          setAccountSection({ accountId, section }),
        );
        if (!saved) setRows(previous);
      });
    },
    [rows, runSave],
  );

  // Change what kind of account this is. Same kind only, and refused outright
  // when something else depends on the account staying what it is — the
  // server's message names that blocker, so it is shown as written rather
  // than replaced with a generic failure.
  const editType = useCallback(
    (accountId: string, type: AccountTypeId) => {
      const target = rows.find((r) => r.accountId === accountId);
      if (!target || target.type === type) return;

      const previous = rows;
      setRows((prev) =>
        prev.map((r) => (r.accountId === accountId ? { ...r, type } : r)),
      );
      startTransition(async () => {
        const saved = await runSave(null, () =>
          setAccountType({ accountId, type }),
        );
        if (!saved) setRows(previous);
      });
    },
    [rows, runSave],
  );

  // ─── Derived totals ───────────────────────────────────────────────────────

  const groups = useMemo(() => {
    // Bucket the account rows by (kind, section) for rendering — BUCKET_ORDER
    // is the one list of buckets the sheet has, so it seeds them all, empty
    // ones included. Each bucket also gets a precomputed subtotal, over the
    // months that have a value: an account with nothing recorded contributes
    // nothing rather than a zero.
    const result = new Map<
      string,
      { rows: SerializedAccountRow[]; subtotal: number }
    >(
      BUCKET_ORDER.map((b) => [
        `${b.type}:${b.category}`,
        { rows: [], subtotal: 0 },
      ]),
    );
    for (const row of rows) {
      const bucket = result.get(`${row.kind}:${row.section}`);
      if (!bucket) continue;
      bucket.rows.push(row);
      if (row.value !== null) bucket.subtotal += row.value;
    }
    for (const bucket of result.values()) {
      bucket.rows.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return result;
  }, [rows]);

  const EMPTY_BUCKET = { rows: [] as SerializedAccountRow[], subtotal: 0 };
  const bucketOf = (kind: AccountKind, section: AccountSection) =>
    groups.get(`${kind}:${section}`) ?? EMPTY_BUCKET;

  const totalOf = (kind: AccountKind) =>
    BUCKET_ORDER.filter((b) => b.type === kind).reduce(
      (sum, b) => sum + bucketOf(b.type, b.category).subtotal,
      0,
    );
  const assetsTotal = totalOf("ASSET");
  const liabilitiesTotal = totalOf("LIABILITY");
  const netWorth = assetsTotal - liabilitiesTotal;

  const withoutValue = rows.filter((r) => r.value === null).length;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderItemRow = (row: SerializedAccountRow) => (
    <ItemRow
      key={row.accountId}
      role="row"
      onMouseDown={() =>
        setFocusedCell({ accountId: row.accountId, field: "label" })
      }
    >
      <SheetCell
        role="rowheader"
        focused={
          focusedCell?.accountId === row.accountId &&
          focusedCell.field === "label"
        }
      >
        <CellInput
          value={row.name}
          placeholder="Name this item"
          onChange={(e) => editField(row.accountId, { name: e.target.value })}
          onFocus={() =>
            setFocusedCell({ accountId: row.accountId, field: "label" })
          }
        />
      </SheetCell>
      <SheetCell
        align="right"
        tone={row.value === null || row.carriedOver ? "dim" : "default"}
        title={
          row.carriedOver
            ? "Carried over from the month you copied — edit to confirm it's still right"
            : undefined
        }
        focused={
          focusedCell?.accountId === row.accountId &&
          focusedCell.field === "value"
        }
      >
        <AmountInput
          currency={currency}
          value={row.value}
          numberFormat={numberFormat}
          onCommit={(v) => editField(row.accountId, { value: v })}
          onFocus={() =>
            setFocusedCell({ accountId: row.accountId, field: "value" })
          }
        />
      </SheetCell>
      <SheetCell
        tone={!row.notes ? "dim" : "default"}
        focused={
          focusedCell?.accountId === row.accountId &&
          focusedCell.field === "notes"
        }
      >
        {/* A note describes this month's figure, so it waits for one: with
            nothing recorded there is no row to hang it on, and saving one
            would have to invent a £0 the user never typed. The server
            refuses that too — this stops the user reaching it. */}
        <CellInput
          value={row.notes ?? ""}
          disabled={row.value === null}
          title={
            row.value === null
              ? "Enter a value first — a note describes this month's figure"
              : undefined
          }
          placeholder={
            row.value === null ? "Enter a value first" : "Notes (optional)"
          }
          onChange={(e) =>
            editField(row.accountId, { notes: e.target.value || null })
          }
          onFocus={() =>
            setFocusedCell({ accountId: row.accountId, field: "notes" })
          }
        />
      </SheetCell>
    </ItemRow>
  );

  const renderSection = (kind: AccountKind, label: string, total: number) => (
    <>
      <SectionRow role="row">
        <SheetCell role="rowheader">{label}</SheetCell>
        <SheetCell align="right">{fmtAmount(total)}</SheetCell>
        <SheetCell />
      </SectionRow>
      {sectionOptionsFor(kind).map((c) => {
        const bucket = bucketOf(kind, c.key);
        const help = CATEGORY_HELP[kind][c.key];
        return (
          <div key={`${kind}-${c.key}`}>
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
        {/* Adding rows comes first because it is what people do most, and the
            leftmost group after the period is the one they read. Filling from
            elsewhere is a month-level operation, so it sits after it. */}
        <ToolbarGroup>
          <ToolbarTool onClick={() => setAddOpen(true)}>+ Add</ToolbarTool>
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
                      {rows.some((r) => r.value !== null)
                        ? `This replaces the values in ${periodState.label}. `
                        : ""}
                      Every asset & liability line carries over, values included
                      — carried values show dimmed until you update each one.
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
        {focusedRow && (
          <ToolbarGroup $rowScoped $engaged>
            {/* What the account is, and where it sits: two separate facts, so
                two controls. The type list is the row's own kind only — an
                account never crosses between assets and liabilities. */}
            <ToolbarSelect
              aria-label="Account type"
              value={focusedRow.type}
              onChange={(e) =>
                editType(focusedRow.accountId, e.target.value as AccountTypeId)
              }
            >
              {accountTypesOfKind(focusedRow.kind).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </ToolbarSelect>
            <ToolbarSelect
              aria-label="Move to section"
              value={focusedRow.section}
              onChange={(e) =>
                editSection(
                  focusedRow.accountId,
                  e.target.value as AccountSection,
                )
              }
            >
              {sectionOptionsFor(focusedRow.kind).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </ToolbarSelect>
          </ToolbarGroup>
        )}
        <ToolbarGroup $rowScoped $engaged={!!focusedCell}>
          <ToolbarTool
            onClick={onDelete}
            disabled={!focusedCell || deleteCountsLoading}
            $danger
          >
            {deleteCountsLoading ? "× Delete row…" : "× Delete row"}
          </ToolbarTool>
        </ToolbarGroup>
        <ToolbarSpacer />
      </Toolbar>
      {rows.some((r) => r.carriedOver) && (
        <CarriedNote>
          Dimmed values were carried over by the copy — update each one to
          confirm it&apos;s still right this month.
        </CarriedNote>
      )}
      {/* The server's own words: a refused type change names what is blocking
          it, and that sentence is what tells the user which link or plan event
          to deal with first. */}
      {saveError && <SheetError role="alert">{saveError}</SheetError>}
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
      {withoutValue > 0 && (
        <MissingNote>
          {withoutValue === 1
            ? "1 account without a value"
            : `${withoutValue} accounts without a value`}
        </MissingNote>
      )}
      {openInfo && (
        <InfoPopover
          data-info-root
          style={{ top: openInfo.top, left: openInfo.left }}
        >
          <InfoTitle>{openInfo.title}</InfoTitle>
          <InfoBody>{openInfo.body}</InfoBody>
        </InfoPopover>
      )}
      <AddAccountDrawer
        open={addOpen}
        year={year}
        month={month}
        onClose={() => setAddOpen(false)}
        onCreated={onAccountCreated}
      />
      {deletePanel && (
        <DeleteScrim
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeletePanel();
          }}
        >
          <DeleteModal ref={deleteModalRef} tabIndex={-1}>
            <DeleteAccountPanel
              accountId={deletePanel.accountId}
              year={year}
              month={month}
              name={deletePanel.name}
              counts={deletePanel.counts}
              isProperty={deletePanel.isProperty}
              onClose={closeDeletePanel}
              onDone={onDeleteDone}
            />
          </DeleteModal>
        </DeleteScrim>
      )}
    </PageShell>
  );
}

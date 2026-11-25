"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import styled, { css } from "styled-components";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { shortDate } from "@/lib/date/humanDate";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { appear, LEAVE_MS, leaving } from "@/lib/motion";
import { hoverFill, reachTall } from "@/lib/pointer";
import {
  DEFAULT_NUMBER_FORMAT,
  formatAmount,
  type NumberFormat,
} from "@/lib/settings/currency";
import {
  activeFilters,
  type FilterLookup,
} from "@/lib/transactions/activeFilters";
import { MAX_PAIRS_PER_ACTION } from "@/lib/transactions/limits";
import {
  type LedgerUrlQuery,
  PAGE_SIZE,
  PAIRS_PER_PAGE,
  pageCount,
  pageWindow,
} from "@/lib/transactions/pagination";
import {
  approveAllOffer,
  approveNotice,
  beforeTags,
  daysApartLabel,
  dismissNotice,
  isEligibleForApproveAll,
  isMarkedAsTransfer,
  isTaggedElsewhere,
  type MarkedPair,
  pairKey,
  pairWarnings,
  type TaggedRow,
  transferSuggestion,
  transferTags,
  UNTAGGED,
  withdrawNotice,
  withHeldPairs,
} from "@/lib/transactions/possibleTransfers";
import type {
  LedgerCategory,
  LedgerPage,
  LedgerPair,
  LedgerTransaction,
  SortColumn,
  SortDir,
} from "@/lib/transactions/server";
import { ledgerFooter, pairFooter } from "@/lib/transactions/totals";
import {
  bulkDeleteTransactions,
  bulkSetTransactionCategory,
  bulkSetTransactionTransfer,
  createAccountAndTransfer,
  createAndAssignCategory,
  dismissPairs,
  markPairsAsTransfer,
  setCategoryApproval,
  setTransactionCategory,
  setTransactionNote,
  setTransactionTransfer,
  unhidePairs,
  unmarkPairsAsTransfer,
} from "./actions";
import { CategoryCombobox, type NewCategoryInput } from "./CategoryCombobox";
import { DetailCard } from "./DetailCard";
import { ExtraColumns } from "./ExtraColumns";
import { FilterDrawer } from "./FilterDrawer";
import { LedgerControls } from "./LedgerControls";
import { PairGroup, PairSummary } from "./PairSummary";
import { SectionHead } from "./SectionHead";

type LedgerAccount = {
  id: string;
  name: string;
  kind: "ASSET" | "LIABILITY";
};

const Section = styled.section`
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

// The ledger's amount column is 96px and a five-figure total in amount-xl
// would overflow it, so the total uses amount-strong; the rules carry the
// emphasis.
// The table's bottom line, set like the budget's grand total: between two ink
// rules on the soft ground.
const TotalCell = styled.td`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.canvasSoft};
  color: ${({ theme }) => theme.colors.ink};
  border-top: 2px solid ${({ theme }) => theme.colors.ink};
  border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  white-space: nowrap;
`;

// Always monochrome: a grand total takes no positive/negative colouring, so it
// never competes with the rows' signs.
const TotalAmount = styled(TotalCell)`
  text-align: right;
  font-family: ${({ theme }) => theme.typography.amountStrong.family};
  font-size: ${({ theme }) => theme.typography.amountStrong.size};
  font-weight: ${({ theme }) => theme.typography.amountStrong.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountStrong.letterSpacing};
  text-transform: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

// Seven columns (select, date, description, account, amount, category, note)
// cannot compress into a phone viewport without becoming unreadable, so below
// desktop the ledger keeps its width and pans inside this scroller.
const TableScroll = styled.div`
  @media (max-width: 991px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

// `table-layout: fixed` and the colgroup below are what stop the ledger jumping
// when a row's details open. Under auto layout the detail row's colSpan=7 cell
// throws its own min-content width into the column algorithm, so expanding a
// row re-measured every column at once — the date cell grew, the description
// cell shrank and wrapped, and every row below shifted sideways. Fixed layout
// ignores spanning cells entirely: the columns are whatever the colgroup says,
// open or closed. The mobile floor rises with it, because fixed columns no
// longer compress to fit and description needs room left over inside it.
const Table = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;

  /* A tablet keeps the columns and pans them. */
  @media (max-width: 991px) and (min-width: 768px) {
    min-width: 940px;
  }

  /* A phone reads the ledger as statement lines instead (see Row): no column
     heads, no panning, every row's amount and category on screen. */
  @media (max-width: 767px) {
    display: block;

    colgroup,
    thead {
      display: none;
    }
    tbody,
    tfoot {
      display: block;
    }
    tfoot tr {
      display: flex;
      justify-content: space-between;
    }
    tfoot td:empty {
      display: none;
    }
  }
`;

// In header order. Description is the only `auto` one, so it absorbs whatever
// the viewport has spare — every other column keeps the width its content
// actually needs.
// The category cell: the picker, then the approval. A suggested category is
// pencilled (dashed, italic) until it is approved.
const CategoryCell = styled.div<{ $pencilled: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  > :first-child {
    flex: 1;
    min-width: 0;
  }

  ${({ $pencilled, theme }) =>
    $pencilled &&
    css`
      > :first-child button {
        border-style: dashed;
        font-style: italic;
        color: ${theme.colors.body};
      }
    `}
`;

// Approving is the one thing a suggested row asks for. Unapproved, it is an
// outlined button in the action colour; approved, it reads "✓ Approved" in the
// sign green and stays a button, so a mis-click can be undone.
const Approval = styled.button<{ $approved: boolean }>`
  ${({ theme, $approved }) => css`
    flex: none;
    min-width: 92px;
    height: 28px;
    padding: 0 ${theme.spacing.sm};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.control.family};
    font-size: 13px;
    font-weight: ${theme.typography.control.weight};
    cursor: pointer;
    border: 1px solid ${$approved ? "transparent" : theme.colors.primary};
    background: transparent;
    color: ${$approved ? theme.colors.positive : theme.colors.primary};
    transition: color 120ms, background-color 120ms, border-color 120ms;

    &:hover {
      border-color: ${$approved ? theme.colors.hairlineStrong : theme.colors.primary};
      background: ${$approved ? "transparent" : theme.colors.primary};
      color: ${$approved ? theme.colors.positive : theme.colors.onPrimary};
    }
  `}
`;

/**
 * The colgroup's widths, with Amount as wide as the longest figure it holds.
 * The layout stays fixed, so opening a row still moves nothing; a fixed 96px
 * just could not hold "−£123,456.78", which ran into the category picker.
 */
function columnWidths(amounts: string[]): [column: string, width: string][] {
  const longest = Math.max(0, ...amounts.map((amount) => amount.length));
  return [
    ["select", "36px"],
    ["date", "100px"],
    ["description", "auto"],
    ["account", "132px"],
    ["amount", `max(96px, calc(${longest}ch + 24px))`],
    ["category", "330px"],
    ["note", "76px"],
  ];
}

// Set as the budget sheet's head: small muted labels closed by a heavy ink
// rule, so the ledger reads as the same kind of table.
const Th = styled.th<{ $align?: "right" }>`
  text-align: ${({ $align }) => ($align === "right" ? "right" : "left")};
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
  color: ${({ theme }) => theme.colors.body};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: 13px;
  font-weight: ${({ theme }) => theme.typography.control.weight};
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
`;

// Clicking a row's plain data cells — date, description, account, amount —
// selects it. The checkbox is a 13px target, and picking the row it sits in is
// what the click was aimed at. The three things that own their own click (the
// checkbox, the category combobox, the details toggle) stop the event so a
// click there still does only its own job.
// On a phone each transaction is a statement line: date and account small on
// top, the description and its amount, then the category with its approval
// and the note toggle. Cells keep their table order (select, date,
// description, account, amount, category, note) and are placed by area.
const Row = styled.tr<{ $leaving: boolean; $isOpen: boolean }>`
  cursor: pointer;
  ${({ $leaving }) => $leaving && leaving}

  &:hover {
    background: ${({ theme }) => theme.colors.canvasSoft};
  }

  @media (max-width: 767px) {
    display: grid;
    /* The note has a fixed track of its own: sharing the amount's meant the
       category box ended wherever that line's amount happened to. */
    grid-template-columns: 32px auto minmax(0, 1fr) auto 3.25rem;
    grid-template-areas:
      "check date account account account"
      "check description description amount amount"
      "check category category category note";
    align-items: center;
    column-gap: ${({ theme }) => theme.spacing.sm};
    row-gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md} 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};

    > td {
      border-bottom: none;
      padding: 0;
      position: static;
      background: transparent;
    }
    > td:nth-child(1) {
      grid-area: check;
      align-self: start;
      padding-top: 2px;
    }
    > td:nth-child(2),
    > td:nth-child(4) {
      font-size: 12px;
      color: ${({ theme }) => theme.colors.body};
    }
    > td:nth-child(2) {
      grid-area: date;
    }
    > td:nth-child(3) {
      grid-area: description;
      font-size: 15px;
      font-weight: 600;
    }
    > td:nth-child(4) {
      grid-area: account;
    }
    > td:nth-child(5) {
      grid-area: amount;
      font-size: 16px;
    }
    > td:nth-child(6) {
      grid-area: category;
      padding-top: ${({ theme }) => theme.spacing.xs};
    }
    > td:nth-child(7) {
      grid-area: note;
      justify-self: end;
      padding-top: ${({ theme }) => theme.spacing.xs};
    }
  }

  /* An open row has no rule under it: its details card hangs off it. Last,
     so it outranks the phone layout's own rule. */
  ${({ $isOpen }) =>
    $isOpen &&
    css`
      &,
      > td {
        border-bottom-color: transparent;
      }
    `}
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.ink};
  vertical-align: middle;
`;

// Date and account cells: a date broken across two lines ("2026-08-" / "05")
// reads as noise, and the table pans horizontally anyway — these cells keep
// their content whole. Their columns are fixed-width (see columnWidths), so an
// account name longer than its column ellipsizes rather than spilling into the
// amount beside it; the cell carries a title so the full name is still readable.
const TdNowrap = styled(Td)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Amount = styled.td<{ $negative: boolean }>`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  font-weight: 600;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.ink : theme.colors.positive};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const EmptyLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

// While the table pans on a phone, the selection column stays pinned so a
// bulk workflow can keep ticking rows with the category column in view — the
// same sticky-left treatment the budget/balance sheets give their category
// cell (SheetRow.styled). Opaque background so panning columns slide under it.
const stickySelect = css`
  @media (max-width: 991px) and (min-width: 768px) {
    position: sticky;
    left: 0;
    z-index: 1;
    background: ${({ theme }) => theme.colors.canvas};
  }
`;

// Narrow non-sorting header — the notes spacer column. Deliberately not
// sticky: only the selection column pins (ThSelect below); this one sits at
// the table's far edge and would ride over the pinned checkbox at full pan.
const ThCheck = styled.th`
  width: 28px;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
`;

// Select-all header cell; pins with its column, see stickySelect.
const ThSelect = styled(ThCheck)`
  ${stickySelect}
`;

// Checkbox cell in each row; see stickySelect.
const TdCheck = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  vertical-align: middle;
  ${stickySelect}
`;

// Toggles the per-transaction detail panel. Accent when there's something
// saved to see (interaction/wayfinding per DESIGN.md), dim otherwise.
const NoteToggle = styled.button<{ $has: boolean }>`
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  /* Bold only once there is a note: fifty bold "+ Note"s outshout the rows. */
  font-weight: ${({ $has, theme }) =>
    $has ? theme.typography.control.weight : 400};
  color: ${({ $has, theme }) =>
    $has ? theme.colors.accent : theme.colors.dim};

  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }

  ${reachTall}
`;

// The open row's details: an empty cell under select and date, so the card
// starts under Description, then the card itself across the rest.
const DetailSpacer = styled.td`
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};

  @media (max-width: 767px) {
    display: none;
  }
`;

const DetailTd = styled.td`
  padding: ${({ theme }) => `${theme.spacing.xxs} ${theme.spacing.md} ${theme.spacing.lg} 0`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};

  @media (max-width: 767px) {
    padding: ${({ theme }) => `${theme.spacing.xxs} 0 ${theme.spacing.lg}`};
  }
`;

// Under the note toggle: centred on "Details" in the 76px note column, or on
// the toggle at the end of a phone's statement line.
const DETAIL_NOTCH = "27px";
const DETAIL_NOTCH_PHONE = "17px";

const LedgerDetailCard = styled(DetailCard)`
  @media (max-width: 767px) {
    &::before {
      right: ${DETAIL_NOTCH_PHONE};
    }
  }
`;

const NoteRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
`;

const DetailHint = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

const Pagination = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const PageButton = styled.button<{ $current?: boolean }>`
  min-width: 30px;
  height: 30px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  background: ${({ $current, theme }) =>
    $current ? theme.colors.primary : theme.colors.canvasSoft};
  color: ${({ $current, theme }) =>
    $current ? theme.colors.onPrimary : theme.colors.ink};
  border: 1px solid
    ${({ $current, theme }) =>
      $current ? theme.colors.primary : theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  font-weight: ${({ theme }) => theme.typography.control.weight};
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.ink};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${({ $current }) => ($current ? "" : hoverFill)}
`;

const PageGap = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.dim};
  font-family: ${({ theme }) => theme.typography.kicker.family};
  font-size: ${({ theme }) => theme.typography.kicker.size};
`;

const NoteArea = styled.textarea`
  flex: 1;
  /* A textarea's default width (Firefox's is wide) is otherwise its floor,
     and on a phone it pushed Save past the screen's edge. */
  min-width: 0;
  resize: vertical;
  min-height: 36px;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -1px;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: rgba(15, 17, 22, 0.5);
`;

const Dialog = styled.dialog`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 480px;
  margin: auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: none;
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  ${appear}
`;

const DialogTitle = styled.h3`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.kicker.family};
  font-size: ${({ theme }) => theme.typography.kicker.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.kicker.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const DialogText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
`;

// After "Not a transfer": says what was hidden and offers it back.
const Toast = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.spacing["2xl"]};
  bottom: ${({ theme }) => theme.spacing["2xl"]};
  z-index: 70;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: rgba(15, 17, 22, 0.08) 0px 4px 12px 0px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};
`;

// How long a notice stays unattended. It does not close while the pointer or
// focus is on it (WCAG 2.2.1), and Show hidden pairs is there after it goes.
const NOTICE_MS = 8000;

type PairIds = { outId: string; inId: string };

// What a pair action reports back: a sentence, and the pairs Undo restores.
type Notice = { text: string; undo: PairIds[] | null };

const idsOf = (pairs: PairIds[]) =>
  pairs.flatMap(({ outId, inId }) => [outId, inId]);

const keyOf = ({ outId, inId }: PairIds) => pairKey(outId, inId);

// The page's Approve all, as the button a click came from.
const ALL = "all";

const savingLabel = (isWithdrawing: boolean) =>
  isWithdrawing ? "Withdrawing…" : "Approving…";

// A pair on screen: its two rows, and where its approval stands.
type ShownPair = {
  pair: LedgerPair;
  out: LedgerTransaction;
  into: LedgerTransaction;
  // Each row is a transfer to the other row's account.
  isApproved: boolean;
  // No warning, so Approve all may take it.
  isEligible: boolean;
  isHeld: boolean;
};

// A pair approved or withdrawn in this view. `marked` is what its rows held
// before this view approved it; null when it has not.
type HeldPair = { pair: LedgerPair; marked: MarkedPair | null };

const COLUMNS: { key: SortColumn; label: string; align?: "right" }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "account", label: "Account" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "category", label: "Category" },
];

type LedgerProps = {
  page: LedgerPage;
  // The URL-derived query this page was rendered for.
  query: LedgerUrlQuery;
  categories: LedgerCategory[];
  // The full, unfiltered account list — not gated by canImportTransactions.
  // Used only as transfer targets and to resolve a row's transferAccountId to
  // a display name; deliberately not the importable-only list the page also
  // queries for the import picker and quick-add.
  transferAccounts: LedgerAccount[];
  transfersEnabled: boolean;
  // The user's money format, from Settings.
  currency?: string;
  numberFormat?: NumberFormat;
  /** A page-level review action, shown beside the search (Approve all). */
  reviewAction?: ReactNode;
  /**
   * Names for archived accounts and deleted categories the URL filters on —
   * a budget month's link can point at one — so their chips can say what
   * they are. Not offered anywhere else.
   */
  filterNames?: FilterLookup;
};

export function Ledger({
  page,
  query,
  categories: initialCategories,
  transferAccounts: initialTransferAccounts,
  transfersEnabled,
  currency = "GBP",
  numberFormat = DEFAULT_NUMBER_FORMAT,
  reviewAction,
  filterNames = { accounts: [], categories: [] },
}: LedgerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Approving a pair, or withdrawing that. Its own transition: the approval
  // buttons wait on it, and nothing else does. `saving` is the button that
  // was pressed (a pair's key, or ALL), which says so until the answer comes.
  const [isApproving, startApproving] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  // Local mirror of the server-rendered rows so mutations can apply
  // optimistically; re-adopted whenever the server re-renders the page.
  const [items, setItems] = useState<LedgerTransaction[]>(page.items);
  const [today] = useState(() => new Date());
  const [search, setSearch] = useState(query.search);
  const [categories, setCategories] = useState(initialCategories);
  const [transferAccounts, setTransferAccounts] = useState(
    initialTransferAccounts,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // The search value we last asked the URL for — see the sync effect below.
  const sentSearchRef = useRef(query.search);
  // Which row's detail panel (kept import columns + editable note) is open.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  // What the last pair action did, while it is on screen.
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isNoticeHeld, setNoticeHeld] = useState(false);
  // The pairs approved or withdrawn in this view. They stay on screen until
  // the query changes, even when a filter (Uncategorised only) stops listing
  // them, so the click that undoes it is always in reach.
  const view = JSON.stringify(query);
  const [held, setHeld] = useState<{ view: string; pairs: HeldPair[] }>({
    view,
    pairs: [],
  });
  if (held.view !== view) setHeld({ view, pairs: [] });
  const heldKeys = new Set(held.pairs.map(({ pair }) => keyOf(pair)));
  const heldRowIds = new Set(idsOf(held.pairs.map(({ pair }) => pair)));

  const { onlyUncategorized, sortColumn, sortDir } = query;
  // The possible-transfers view: rows come in pairs, and the page is pairs.
  const pairs = page.pairs;
  const isPairView = pairs !== null;
  // Each pair on screen with its rows: the page's, plus the held ones it no
  // longer lists. A pair whose rows are fading out after an action is gone.
  const rowById = new Map(items.map((row) => [row.id, row]));
  const shown: ShownPair[] = withHeldPairs(
    pairs ?? [],
    held.pairs.map(({ pair }) => pair),
  ).flatMap((listed) => {
    const out = rowById.get(listed.outId);
    const into = rowById.get(listed.inId);
    if (!out || !into) return [];
    // Read off the rows as they are now, not as the page last had them.
    const pair = { ...listed, isTaggedElsewhere: isTaggedElsewhere(out, into) };
    return [
      {
        pair,
        out,
        into,
        isApproved: isMarkedAsTransfer(out, into),
        isEligible: isEligibleForApproveAll(pair),
        isHeld: heldKeys.has(keyOf(pair)),
      },
    ];
  });
  const listedKeys = new Set((pairs ?? []).map(keyOf));
  const heldUnlisted = shown.filter(
    ({ pair }) => !listedKeys.has(keyOf(pair)),
  ).length;
  // In the pair view the rows on screen are the shown pairs' rows.
  const rows = isPairView
    ? shown.flatMap(({ out, into }) => [out, into])
    : items;
  // A row categorised under "Uncategorised only" leaves the ordinary ledger
  // at once. In the pair view the server decides, since a pair stays while
  // either of its rows still needs dealing with.
  const dropsResolvedRows = onlyUncategorized && !isPairView;

  // One source for both the badge count and the chips, so the number can never
  // claim more or fewer filters than the row beneath it shows. The account
  // names come from the full active-account list rather than the importable
  // subset, so a filter can never point at an account the chip cannot name.
  const chips = activeFilters(query, {
    accounts: [...transferAccounts, ...filterNames.accounts],
    categories: [...categories, ...filterNames.categories],
  });

  // Nets the rows on screen, not every matching row — and says which it is,
  // so a partial sum can never read as a grand total.
  const footer = isPairView
    ? pairFooter(rows, pairs.length + heldUnlisted, page.total + heldUnlisted)
    : ledgerFooter(rows, page.total);
  const widths = columnWidths(
    [...rows.map((tx) => tx.amount), footer.net].map((amount) =>
      formatAmount(currency, amount, numberFormat),
    ),
  );

  // Adopt fresh server data whenever the rendered page changes — a URL
  // navigation, or a revalidation after a mutation. Stale row selections are
  // dropped with it. A held pair's rows stay when the page stops listing them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page is the trigger; the held pairs are read as they stand when it arrives.
  useEffect(() => {
    const listed = new Set(page.items.map((row) => row.id));
    setItems((prev) => [
      ...page.items,
      ...prev.filter((row) => heldRowIds.has(row.id) && !listed.has(row.id)),
    ]);
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    if (!notice || isNoticeHeld) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, isNoticeHeld]);

  useEffect(() => {
    setCategories(initialCategories);
    setTransferAccounts(initialTransferAccounts);
  }, [initialCategories, initialTransferAccounts]);

  // Keep the search box in step with the URL (e.g. back/forward navigation)
  // — but never adopt the echo of our own typing.
  //
  // `q` is debounced 300ms and then round-trips through the server, so the
  // `query.search` that comes back is always older than what is in the box by
  // however long that took. Adopting it deletes every character typed in
  // between, which reads as the box swallowing your input as you type.
  // Comparing against what we last asked the URL for tells the two apart: an
  // echo matches, a back/forward navigation does not.
  useEffect(() => {
    if (query.search === sentSearchRef.current) return;
    sentSearchRef.current = query.search;
    setSearch(query.search);
  }, [query.search]);

  // The whole ledger query lives in the URL, so the server renders exactly the
  // requested page and back/forward + shareable links work. Filter and sort
  // changes replace the history entry (and reset to page 1); page navigation
  // pushes so the back button steps through pages.
  const updateParams = (
    patch: Record<string, string | null>,
    mode: "push" | "replace",
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router[mode](qs ? `/transactions?${qs}` : "/transactions", {
        scroll: false,
      });
    });
  };

  const runSearch = useDebouncedCallback((value: string) => {
    // Record what the URL is being asked for, so the sync effect above can
    // recognise the answer as ours. Trimmed, because that is what is sent.
    const next = value.trim();
    sentSearchRef.current = next;
    updateParams({ q: next || null, page: null }, "replace");
  }, 300);

  const onSearch = (value: string) => {
    setSearch(value);
    runSearch(value);
  };

  const onSort = (key: SortColumn) => {
    const dir: SortDir =
      sortColumn === key && sortDir === "desc" ? "asc" : "desc";
    // The default order (date desc) keeps a clean URL.
    if (key === "date" && dir === "desc") {
      updateParams({ sort: null, dir: null, page: null }, "replace");
    } else {
      updateParams({ sort: key, dir, page: null }, "replace");
    }
  };

  const totalPages = pageCount(
    page.total,
    isPairView ? PAIRS_PER_PAGE : PAGE_SIZE,
  );

  const goToPage = (n: number) =>
    updateParams({ page: n <= 1 ? null : String(n) }, "push");

  // Rows that no longer belong on screen fade before they go, so the eye can
  // follow what a categorise or a delete just did. The server's next render
  // drops them for good; this only covers the moment in between.
  const dismissRows = (ids: string[]) => {
    setLeavingIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => !ids.includes(t.id)));
      setLeavingIds(
        (prev) => new Set([...prev].filter((id) => !ids.includes(id))),
      );
    }, LEAVE_MS);
  };

  // Optimistically reflect a category assignment; clears any transfer. Drops the
  // row if it no longer matches the "uncategorized only" filter.
  const applyAssignment = (
    transactionId: string,
    categoryId: string | null,
  ) => {
    if (dropsResolvedRows && categoryId !== null) {
      dismissRows([transactionId]);
      return;
    }
    setItems((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              categoryId,
              transferAccountId: null,
              isCategoryConfirmed: true,
            }
          : t,
      ),
    );
  };

  // Optimistically reflect a transfer; clears any category. A transfer is no
  // longer "uncategorized", so drop it under that filter.
  const applyTransfer = (transactionId: string, accountId: string) => {
    if (dropsResolvedRows) {
      dismissRows([transactionId]);
      return;
    }
    setItems((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              transferAccountId: accountId,
              categoryId: null,
              isCategoryConfirmed: true,
            }
          : t,
      ),
    );
  };

  const onSelect = (transactionId: string, categoryId: string | null) => {
    applyAssignment(transactionId, categoryId);
    startTransition(async () => {
      await setTransactionCategory({ transactionId, categoryId });
    });
  };

  // Approves a pencilled category, or withdraws an approval so the row goes
  // back to pencil.
  const onApprove = (transactionId: string, approved: boolean) => {
    setItems((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, isCategoryConfirmed: approved } : t,
      ),
    );
    startTransition(async () => {
      await setCategoryApproval({ transactionIds: [transactionId], approved });
    });
  };

  const onTransfer = (transactionId: string, accountId: string) => {
    applyTransfer(transactionId, accountId);
    startTransition(async () => {
      await setTransactionTransfer({ transactionId, accountId });
    });
  };

  const onCreateAccountAndTransfer = (transactionId: string, name: string) => {
    startTransition(async () => {
      const created = await createAccountAndTransfer({
        transactionIds: [transactionId],
        name,
      });
      setTransferAccounts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      applyTransfer(transactionId, created.id);
    });
  };

  const onCreateAndAssign = (
    transactionId: string,
    input: NewCategoryInput,
  ) => {
    startTransition(async () => {
      const created = await createAndAssignCategory({
        transactionIds: [transactionId],
        ...input,
      });
      setCategories((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
        ),
      );
      applyAssignment(transactionId, created.id);
    });
  };

  const sortMark = (key: SortColumn) =>
    sortColumn === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  const hasSelection = selected.size > 0;

  const allOnPageSelected =
    rows.length > 0 && rows.every((t) => selected.has(t.id));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected(allOnPageSelected ? new Set() : new Set(rows.map((t) => t.id)));

  // The categorize-select-categorize loop: once a batch is categorised, clear
  // the search and put the cursor back in it so the next merchant can be
  // typed straight away.
  const resetSearchForNextBatch = () => {
    setSearch("");
    runSearch("");
    searchRef.current?.focus();
  };

  // Applies a category to every selected row, optimistically, then commits in
  // one server round-trip. Mirrors the single-row behaviour under the
  // "uncategorized only" filter: newly categorised rows leave the list.
  const onBulkCategorise = (categoryId: string | null) => {
    const ids = Array.from(selected);
    if (dropsResolvedRows && categoryId !== null) {
      dismissRows(ids);
    } else {
      setItems((prev) =>
        prev.map((t) =>
          selected.has(t.id)
            ? {
                ...t,
                categoryId,
                transferAccountId: null,
                isCategoryConfirmed: true,
              }
            : t,
        ),
      );
    }
    setSelected(new Set());
    startTransition(async () => {
      await bulkSetTransactionCategory({ transactionIds: ids, categoryId });
    });
    resetSearchForNextBatch();
  };

  // Tags every selected row as a transfer to `accountId`, optimistically.
  // Rows that belong to the target account are left untouched — the server
  // skips them too (a transfer to itself is meaningless).
  const onBulkTransfer = (accountId: string) => {
    const ids = items
      .filter((t) => selected.has(t.id) && t.accountId !== accountId)
      .map((t) => t.id);
    const changed = new Set(ids);
    if (dropsResolvedRows) {
      dismissRows(ids);
    } else {
      setItems((prev) =>
        prev.map((t) =>
          changed.has(t.id)
            ? {
                ...t,
                transferAccountId: accountId,
                categoryId: null,
                isCategoryConfirmed: true,
              }
            : t,
        ),
      );
    }
    setSelected(new Set());
    if (ids.length > 0) {
      startTransition(async () => {
        await bulkSetTransactionTransfer({ transactionIds: ids, accountId });
      });
    }
    resetSearchForNextBatch();
  };

  // Bulk mirrors of the combobox's create affordances: one action creates the
  // category/account and tags the whole selection.
  const onBulkCreateAndAssign = (input: NewCategoryInput) => {
    const ids = Array.from(selected);
    setSelected(new Set());
    startTransition(async () => {
      const created = await createAndAssignCategory({
        transactionIds: ids,
        ...input,
      });
      setCategories((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
        ),
      );
      if (dropsResolvedRows) {
        dismissRows(ids);
        return;
      }
      setItems((prev) =>
        prev.map((t) =>
          ids.includes(t.id)
            ? { ...t, categoryId: created.id, transferAccountId: null }
            : t,
        ),
      );
    });
    resetSearchForNextBatch();
  };

  const onBulkCreateAccountAndTransfer = (name: string) => {
    const ids = Array.from(selected);
    setSelected(new Set());
    startTransition(async () => {
      const created = await createAccountAndTransfer({
        transactionIds: ids,
        name,
      });
      setTransferAccounts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (dropsResolvedRows) {
        dismissRows(ids);
        return;
      }
      setItems((prev) =>
        prev.map((t) =>
          ids.includes(t.id)
            ? { ...t, transferAccountId: created.id, categoryId: null }
            : t,
        ),
      );
    });
    resetSearchForNextBatch();
  };

  const toggleExpanded = (tx: LedgerTransaction) => {
    if (expandedId === tx.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(tx.id);
    setNoteDraft(tx.note ?? "");
  };

  const saveNote = (transactionId: string) => {
    const note = noteDraft.trim();
    setItems((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, note: note || null } : t,
      ),
    );
    setExpandedId(null);
    startTransition(async () => {
      await setTransactionNote({ transactionId, note });
    });
  };

  // Pairs whose both rows are ticked: a pair is ticked as one, so this is
  // every pair the selection touches.
  const tickedPairs = shown.filter(
    ({ pair }) => selected.has(pair.outId) && selected.has(pair.inId),
  );
  const selectedPairs: PairIds[] = tickedPairs.map(
    ({ pair: { outId, inId } }) => ({ outId, inId }),
  );

  const togglePair = (pair: LedgerPair) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const isTicked = prev.has(pair.outId) && prev.has(pair.inId);
      for (const id of [pair.outId, pair.inId]) {
        if (isTicked) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // Sets the category cell of the rows named, leaving the rest as they are.
  const tagRows = (tags: TaggedRow[]) => {
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    setItems((prev) =>
      prev.map((row) => {
        const tag = byId.get(row.id);
        return tag ? { ...row, ...tag } : row;
      }),
    );
  };

  const hold = (chosen: LedgerPair[]) =>
    setHeld((prev) => {
      const known = new Set(prev.pairs.map(({ pair }) => keyOf(pair)));
      const added = chosen.filter((pair) => !known.has(keyOf(pair)));
      return {
        ...prev,
        pairs: [
          ...prev.pairs,
          ...added.map((pair) => ({ pair, marked: null })),
        ],
      };
    });

  // Applies an action's answer to the held pairs; null lets one go. An answer
  // that arrives after the user moved on finds that view's pairs gone.
  const updateHeld = (change: (pair: HeldPair) => HeldPair | null) =>
    setHeld((prev) =>
      prev.view === view
        ? { view, pairs: prev.pairs.flatMap((pair) => change(pair) ?? []) }
        : prev,
    );

  // Marks each pair as a transfer, each row to the other row's account, and
  // keeps it on screen. The rows change when the server answers, not before:
  // they never show a transfer that was not stored. `from` is the button
  // pressed, if it was an approval button; `left` is the warned pairs Approve
  // all passed over, for the notice.
  const onApprovePairs = (
    chosen: ShownPair[],
    from: string | null,
    left = 0,
  ) => {
    const sent = chosen.slice(0, MAX_PAIRS_PER_ACTION);
    if (sent.length === 0) return;
    hold(sent.map(({ pair }) => pair));
    setSaving(from);
    startApproving(async () => {
      const { marked, skipped } = await markPairsAsTransfer({
        pairs: sent.map(({ pair: { outId, inId } }) => ({ outId, inId })),
      });
      const before = new Map(marked.map((pair) => [keyOf(pair), pair]));
      tagRows(
        sent.flatMap(({ pair, out, into }) =>
          before.has(keyOf(pair)) ? transferTags(out, into) : [],
        ),
      );
      // A pair the server would not mark is not kept: the refreshed page
      // decides whether it is still listed.
      const asked = new Set(sent.map(({ pair }) => keyOf(pair)));
      updateHeld((heldPair) => {
        const key = keyOf(heldPair.pair);
        if (!asked.has(key)) return heldPair;
        const was = before.get(key);
        return was ? { ...heldPair, marked: was } : null;
      });
      setSaving(null);
      showNotice({
        text: approveNotice(marked.length, left, skipped),
        undo: null,
      });
    });
  };

  // Withdraws an approval: each row goes back to what the server said it held
  // when this view approved the pair, or to uncategorised for a pair marked
  // before this visit.
  const onWithdrawPairs = (chosen: ShownPair[], from: string) => {
    const kept = chosen.slice(0, MAX_PAIRS_PER_ACTION);
    if (kept.length === 0) return;
    const remembered = new Map(
      held.pairs.map(({ pair, marked }) => [keyOf(pair), marked]),
    );
    const sent = kept.map(
      ({ pair: { outId, inId } }) =>
        remembered.get(pairKey(outId, inId)) ?? {
          outId,
          inId,
          outBefore: UNTAGGED,
          inBefore: UNTAGGED,
        },
    );
    hold(kept.map(({ pair }) => pair));
    setSaving(from);
    startApproving(async () => {
      const { skipped } = await unmarkPairsAsTransfer({ pairs: sent });
      const leftAlone = new Set(skipped.map(keyOf));
      const restored = sent.filter((pair) => !leftAlone.has(keyOf(pair)));
      tagRows(restored.flatMap(beforeTags));
      const putBack = new Set(restored.map(keyOf));
      updateHeld((heldPair) =>
        putBack.has(keyOf(heldPair.pair))
          ? { ...heldPair, marked: null }
          : heldPair,
      );
      setSaving(null);
      showNotice({
        text: withdrawNotice(restored.length, skipped.length),
        undo: null,
      });
    });
  };

  const onMarkPairs = () => {
    onApprovePairs(
      tickedPairs.filter(({ isApproved }) => !isApproved),
      null,
    );
    setSelected(new Set());
  };

  const showNotice = (next: Notice) => {
    setNoticeHeld(false);
    setNotice(next);
  };

  // The chosen pairs' rows fade while their action runs. Once it answers, the
  // pairs it acted on leave the list and the rest come back: a pair the
  // server did not store must not stay hidden with nothing behind it.
  const fadePairs = (chosen: PairIds[]) =>
    setLeavingIds((prev) => new Set([...prev, ...idsOf(chosen)]));

  const settlePairs = (chosen: PairIds[], stayed: PairIds[]) => {
    const stays = new Set(idsOf(stayed));
    const faded = new Set(idsOf(chosen));
    setItems((prev) => prev.filter((t) => !faded.has(t.id) || stays.has(t.id)));
    setLeavingIds((prev) => new Set([...prev].filter((id) => !faded.has(id))));
  };

  // "Not a transfer" hides the pairs (with an Undo); "Unhide" brings hidden
  // ones back. Either way they leave this view.
  const onDismissPairs = () => {
    const chosen = selectedPairs;
    fadePairs(chosen);
    setSelected(new Set());
    startTransition(async () => {
      const outcome = await dismissPairs({ pairs: chosen });
      if (!outcome.ok) {
        settlePairs(chosen, chosen);
        showNotice({ text: outcome.reason, undo: null });
        return;
      }
      settlePairs(chosen, outcome.skipped);
      const isSkipped = (pair: PairIds) =>
        outcome.skipped.some(
          (s) => s.outId === pair.outId && s.inId === pair.inId,
        );
      const hidden = chosen.filter((pair) => !isSkipped(pair));
      showNotice({
        text: dismissNotice(hidden.length, outcome.skipped.length),
        undo: hidden.length > 0 ? hidden : null,
      });
    });
  };

  const onUnhidePairs = () => {
    const chosen = selectedPairs;
    fadePairs(chosen);
    setSelected(new Set());
    startTransition(async () => {
      await unhidePairs({ pairs: chosen });
      settlePairs(chosen, []);
    });
  };

  const onUndoDismiss = () => {
    const chosen = notice?.undo;
    if (!chosen) return;
    setNotice(null);
    setNoticeHeld(false);
    startTransition(async () => {
      await unhidePairs({ pairs: chosen });
    });
  };

  const pairActions =
    selectedPairs.length === 0 ? null : query.showHiddenPairs ? (
      <Button type="button" onClick={onUnhidePairs}>
        Unhide
      </Button>
    ) : (
      <>
        {/* Waits like the approval buttons: it is the same action. */}
        <Button type="button" onClick={onMarkPairs} disabled={isApproving}>
          Mark as transfer
        </Button>
        <Button variant="outline" type="button" onClick={onDismissPairs}>
          Not a transfer
        </Button>
      </>
    );

  // The page's Approve all: every pair without a warning, then the way back.
  const offer =
    isPairView && !query.showHiddenPairs ? approveAllOffer(shown) : null;
  const approveAll = offer ? (
    <Approval
      type="button"
      $approved={offer.action === "withdraw"}
      aria-pressed={offer.action === "withdraw"}
      disabled={isApproving}
      title={
        offer.action === "withdraw"
          ? "Approved. Click to undo."
          : "Marks every pair on this page as a transfer, except pairs with a warning."
      }
      onClick={() =>
        offer.action === "withdraw"
          ? onWithdrawPairs(offer.pairs, ALL)
          : onApprovePairs(
              offer.pairs,
              ALL,
              shown.filter((pair) => !pair.isEligible && !pair.isApproved)
                .length,
            )
      }
    >
      {isApproving && saving === ALL
        ? savingLabel(offer.action === "withdraw")
        : offer.action === "withdraw"
          ? "✓ All approved"
          : `Approve all ${offer.pairs.length}`}
    </Approval>
  ) : null;

  const pairLabel = (pair: LedgerPair) =>
    [
      `${pair.outAccountName} → ${pair.inAccountName}`,
      formatAmount(currency, pair.amount, numberFormat),
      daysApartLabel(pair.daysApart),
    ].join(" · ");

  // One ledger row and, when open, its details. `inPair` marks a row shown
  // under a possible-transfer pair: no checkbox of its own (the pair's tick
  // selects both), a click toggles the pair, and no note. `suggestion` is the
  // transfer its pair suggests, pencilled in where the row has nothing.
  const renderRow = (
    tx: LedgerTransaction,
    inPair: LedgerPair | null,
    suggestion: string | null,
  ) => (
    <Fragment key={tx.id}>
      <Row
        $leaving={leavingIds.has(tx.id)}
        $isOpen={expandedId === tx.id}
        onClick={() => (inPair ? togglePair(inPair) : toggleRow(tx.id))}
      >
        <TdCheck>
          {inPair ? null : (
            <Checkbox
              checked={selected.has(tx.id)}
              onChange={() => toggleRow(tx.id)}
              // Without this the change handler and the row's click
              // handler both fire and cancel each other out.
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${tx.description}`}
            />
          )}
        </TdCheck>
        <TdNowrap>{shortDate(tx.date, today)}</TdNowrap>
        <Td>{tx.description}</Td>
        <TdNowrap title={tx.accountName}>{tx.accountName}</TdNowrap>
        <Amount $negative={tx.amount < 0}>
          {formatAmount(currency, tx.amount, numberFormat)}
        </Amount>
        <Td onClick={(e) => e.stopPropagation()}>
          <CategoryCell
            $pencilled={
              suggestion !== null ||
              (tx.categoryId !== null && !tx.isCategoryConfirmed)
            }
            title={
              suggestion === null
                ? undefined
                : "Suggested from the other row of this pair. Nothing is saved until you approve the transfer."
            }
          >
            <CategoryCombobox
              categories={categories}
              transferAccounts={transferAccounts}
              value={tx.categoryId}
              transferAccountId={tx.transferAccountId}
              placeholder={suggestion ?? undefined}
              ownAccountId={tx.accountId}
              defaultType={tx.amount < 0 ? "EXPENSE" : "INCOME"}
              transfersEnabled={transfersEnabled}
              // A ticked row speaks for the whole selection: its
              // category box does what the controls card's does.
              onSelect={(categoryId) =>
                selected.has(tx.id)
                  ? onBulkCategorise(categoryId)
                  : onSelect(tx.id, categoryId)
              }
              onCreate={(input) =>
                selected.has(tx.id)
                  ? onBulkCreateAndAssign(input)
                  : onCreateAndAssign(tx.id, input)
              }
              onTransfer={(accountId) =>
                selected.has(tx.id)
                  ? onBulkTransfer(accountId)
                  : onTransfer(tx.id, accountId)
              }
              onCreateAccount={(name) =>
                selected.has(tx.id)
                  ? onBulkCreateAccountAndTransfer(name)
                  : onCreateAccountAndTransfer(tx.id, name)
              }
            />
            {tx.categoryId !== null && (
              <Approval
                type="button"
                $approved={tx.isCategoryConfirmed}
                aria-pressed={tx.isCategoryConfirmed}
                aria-label={`Approve the category for ${tx.description}`}
                title={
                  tx.isCategoryConfirmed
                    ? "Approved. Click to undo."
                    : "Suggested from your history. Approve it if it's right."
                }
                onClick={() => onApprove(tx.id, !tx.isCategoryConfirmed)}
              >
                {tx.isCategoryConfirmed ? "✓ Approved" : "Approve"}
              </Approval>
            )}
          </CategoryCell>
        </Td>
        {/* In a pair the job is matching the two sides, so a row offers
            only what its import kept, and no note. */}
        <Td onClick={(e) => e.stopPropagation()}>
          {inPair && !tx.extra ? null : (
            <NoteToggle
              type="button"
              $has={Boolean(tx.note || tx.extra)}
              aria-expanded={expandedId === tx.id}
              onClick={() => toggleExpanded(tx)}
            >
              {inPair
                ? "Details"
                : tx.note
                  ? "Note ●"
                  : tx.extra
                    ? "Details"
                    : "+ Note"}
            </NoteToggle>
          )}
        </Td>
      </Row>
      {expandedId === tx.id && (
        <tr>
          <DetailSpacer colSpan={2} />
          <DetailTd colSpan={5}>
            <LedgerDetailCard $notchRight={DETAIL_NOTCH}>
              {tx.extra ? (
                <>
                  <ExtraColumns extra={tx.extra} />
                  <DetailHint>
                    Showing only the columns ticked under “Also keep” when this
                    statement was imported.
                  </DetailHint>
                </>
              ) : null}
              {inPair ? null : (
                <NoteRow>
                  <NoteArea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a note…"
                    aria-label={`Note for ${tx.description}`}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setExpandedId(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => saveNote(tx.id)}>
                    Save
                  </Button>
                </NoteRow>
              )}
            </LedgerDetailCard>
          </DetailTd>
        </tr>
      )}
    </Fragment>
  );

  const onBulkDelete = () => {
    const ids = Array.from(selected);
    dismissRows(ids);
    setSelected(new Set());
    setConfirmDelete(false);
    startTransition(async () => {
      await bulkDeleteTransactions({ transactionIds: ids });
    });
  };

  return (
    <Section>
      <SectionHead>Review transactions</SectionHead>

      <LedgerControls
        search={search}
        searchRef={searchRef}
        onSearch={onSearch}
        chips={chips}
        onClearFilter={(chip) =>
          updateParams({ ...chip.clear, page: null }, "replace")
        }
        onOpenFilters={() => setFiltersOpen(true)}
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        onDelete={() => setConfirmDelete(true)}
        // In the pair view the slot is the pairs' Approve all: beside the
        // categories' one it would read as the same button twice.
        reviewAction={
          isPairView && !query.showHiddenPairs ? approveAll : reviewAction
        }
        selectionActions={pairActions}
        categorizer={
          <CategoryCombobox
            categories={categories}
            transferAccounts={transferAccounts}
            value={null}
            transferAccountId={null}
            // Bulk selections can span accounts, so no account is excluded
            // here; the server skips any row already owned by the target.
            ownAccountId=""
            defaultType="EXPENSE"
            transfersEnabled={transfersEnabled}
            disabled={!hasSelection}
            placeholder="Set category…"
            fill
            alwaysClearable
            triggerLabel="Set category for selected transactions"
            onSelect={onBulkCategorise}
            onCreate={onBulkCreateAndAssign}
            onTransfer={onBulkTransfer}
            onCreateAccount={onBulkCreateAccountAndTransfer}
          />
        }
      />

      <FilterDrawer
        open={filtersOpen}
        query={query}
        accounts={transferAccounts}
        categories={categories}
        transfersEnabled={transfersEnabled}
        onClose={() => setFiltersOpen(false)}
        onApply={(params) => {
          setFiltersOpen(false);
          updateParams({ ...params, page: null }, "replace");
        }}
      />

      {rows.length === 0 ? (
        <Empty>
          {/* Any narrowing at all — the toggle, the search box, or a drawer
              filter — means the ledger is not necessarily empty, just this
              view of it. The first-run copy below would read as "your
              transactions are gone". */}
          {query.showHiddenPairs ? (
            "No hidden pairs."
          ) : isPairView && !search && chips.length === 1 ? (
            "No possible transfers: no two rows in different accounts cancel each other out."
          ) : onlyUncategorized || search || chips.length > 0 ? (
            "No transactions match."
          ) : (
            <>
              No transactions yet — import a statement above. First time?{" "}
              {/* This is where new users now land, so it's the one empty state
                  most likely to be someone's first screen. */}
              <EmptyLink href="/guide">See how it works</EmptyLink>.
            </>
          )}
        </Empty>
      ) : (
        <TableScroll data-ledger-scroller>
          <Table>
            <colgroup>
              {widths.map(([column, width]) => (
                <col key={column} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <ThSelect>
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={hasSelection && !allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all transactions on this page"
                  />
                </ThSelect>
                {COLUMNS.map((col) => (
                  <Th
                    key={col.key}
                    $align={col.align}
                    // Pairs keep their own order (newest first), so the
                    // columns do not sort in that view.
                    onClick={isPairView ? undefined : () => onSort(col.key)}
                  >
                    {col.label}
                    {isPairView ? null : sortMark(col.key)}
                  </Th>
                ))}
                <ThCheck aria-label="Notes" />
              </tr>
            </thead>
            {isPairView ? (
              shown.map((entry) => {
                const { pair, out, into, isApproved } = entry;
                const isTicked = selected.has(out.id) && selected.has(into.id);
                const label = pairLabel(pair);
                // The user said a hidden pair is not a transfer.
                const suggest = (
                  row: LedgerTransaction,
                  other: LedgerTransaction,
                ) => (pair.isHidden ? null : transferSuggestion(row, other));
                return (
                  <PairGroup
                    key={`${pair.outId}|${pair.inId}`}
                    $selected={isTicked}
                    $approved={isApproved}
                  >
                    <PairSummary
                      label={label}
                      warnings={pairWarnings(pair)}
                      checked={isTicked}
                      onToggle={() => togglePair(pair)}
                      span={widths.length - 1}
                      action={
                        pair.isHidden ? null : (
                          <Approval
                            type="button"
                            $approved={isApproved}
                            aria-pressed={isApproved}
                            aria-label={`Approve transfer ${label}`}
                            title={
                              isApproved
                                ? "Approved. Click to undo."
                                : "Marks both rows as a transfer between these two accounts."
                            }
                            disabled={isApproving}
                            onClick={(e) => {
                              // The line's own click ticks the pair.
                              e.stopPropagation();
                              if (isApproved)
                                onWithdrawPairs([entry], keyOf(pair));
                              else onApprovePairs([entry], keyOf(pair));
                            }}
                          >
                            {isApproving && saving === keyOf(pair)
                              ? savingLabel(isApproved)
                              : isApproved
                                ? "✓ Approved"
                                : "Approve transfer"}
                          </Approval>
                        )
                      }
                    />
                    {renderRow(out, pair, suggest(out, into))}
                    {renderRow(into, pair, suggest(into, out))}
                  </PairGroup>
                );
              })
            ) : (
              <tbody>{items.map((tx) => renderRow(tx, null, null))}</tbody>
            )}
            <tfoot>
              <tr>
                {/* Spans select + date so the label starts under Description,
                    leaving the figure aligned beneath the Amount column. */}
                <TotalCell colSpan={3}>{footer.label}</TotalCell>
                <TotalCell />
                <TotalAmount>
                  {formatAmount(currency, footer.net, numberFormat)}
                </TotalAmount>
                <TotalCell />
                <TotalCell />
              </tr>
            </tfoot>
          </Table>
        </TableScroll>
      )}

      {totalPages > 1 && (
        <Pagination aria-label="Ledger pages">
          <PageButton
            type="button"
            disabled={query.page <= 1 || pending}
            onClick={() => goToPage(query.page - 1)}
            aria-label="Previous page"
          >
            ◀
          </PageButton>
          {pageWindow(query.page, totalPages).map((item, i) =>
            item === "gap" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity beyond position
              <PageGap key={`gap-${i}`}>…</PageGap>
            ) : (
              <PageButton
                key={item}
                type="button"
                $current={item === query.page}
                aria-current={item === query.page ? "page" : undefined}
                disabled={pending}
                onClick={() => goToPage(item)}
              >
                {item}
              </PageButton>
            ),
          )}
          <PageButton
            type="button"
            disabled={query.page >= totalPages || pending}
            onClick={() => goToPage(query.page + 1)}
            aria-label="Next page"
          >
            ▶
          </PageButton>
        </Pagination>
      )}

      {notice && (
        <Toast
          role="status"
          aria-live="polite"
          onMouseEnter={() => setNoticeHeld(true)}
          onMouseLeave={() => setNoticeHeld(false)}
          onFocus={() => setNoticeHeld(true)}
          onBlur={() => setNoticeHeld(false)}
        >
          {notice.text}
          {notice.undo ? (
            <Button variant="outline" type="button" onClick={onUndoDismiss}>
              Undo
            </Button>
          ) : null}
        </Toast>
      )}

      {confirmDelete && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          }}
        >
          <Dialog open aria-label="Confirm delete">
            <DialogTitle>Delete {selected.size} transaction(s)?</DialogTitle>
            <DialogText>
              Deleting imported transactions leaves your records incomplete —
              totals, budget actuals and averages will no longer match your bank
              statements. If these rows are miscategorised or noise, consider
              categorising them (or tagging them as transfers) instead, so your
              history stays accurate.
            </DialogText>
            <DialogActions>
              <Button
                variant="outline"
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                Keep them
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={onBulkDelete}
              >
                Delete {selected.size} transaction(s)
              </Button>
            </DialogActions>
          </Dialog>
        </Overlay>
      )}
    </Section>
  );
}

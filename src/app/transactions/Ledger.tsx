"use client";

import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  type LedgerUrlQuery,
  pageCount,
  pageWindow,
} from "@/lib/transactions/pagination";
import type {
  LedgerCategory,
  LedgerPage,
  LedgerTransaction,
  SortColumn,
  SortDir,
} from "@/lib/transactions/server";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";
import styled from "styled-components";
import { CategoryCombobox, type NewCategoryInput } from "./CategoryCombobox";
import {
  bulkDeleteTransactions,
  bulkSetTransactionCategory,
  createAccount,
  createCategory,
  setTransactionCategory,
  setTransactionNote,
  setTransactionTransfer,
} from "./actions";

type LedgerAccount = { id: string; name: string };

const Section = styled.section`
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
`;

const Title = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const Nudge = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  cursor: pointer;
`;

const SwitchInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
`;

const SwitchTrack = styled.span`
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.hairlineStrong};
  transition: background 0.15s ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.canvas};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
  }

  ${SwitchInput}:checked + & {
    background: ${({ theme }) => theme.colors.accent};
  }
  ${SwitchInput}:checked + &::after {
    transform: translateX(16px);
  }
  ${SwitchInput}:focus-visible + & {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Search = styled.input`
  flex: 1;
  min-width: 160px;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;

  @media (max-width: 991px) {
    min-width: 720px;
  }
`;

const Th = styled.th<{ $align?: "right" }>`
  text-align: ${({ $align }) => ($align === "right" ? "right" : "left")};
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.dim};
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.ink};
  vertical-align: middle;
`;

const Amount = styled.td<{ $negative: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.ink : theme.colors.positive};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

// Checkbox column header — unlike the data columns it doesn't sort.
const ThCheck = styled.th`
  width: 28px;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

// Toggles the per-transaction detail panel. Accent when there's something
// saved to see (interaction/wayfinding per DESIGN.md), dim otherwise.
const NoteToggle = styled.button<{ $has: boolean }>`
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ $has, theme }) =>
    $has ? theme.colors.accent : theme.colors.dim};
`;

const DetailTd = styled.td`
  padding: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

const DetailPanel = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ExtraList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const ExtraPair = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
`;

const ExtraKey = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
  margin-right: ${({ theme }) => theme.spacing.xs};
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
    $current ? theme.colors.primary : theme.colors.canvas};
  color: ${({ $current, theme }) =>
    $current ? theme.colors.onPrimary : theme.colors.ink};
  border: 1px solid
    ${({ $current, theme }) =>
      $current ? theme.colors.primary : theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.ink};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageGap = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.dim};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
`;

const NoteArea = styled.textarea`
  flex: 1;
  resize: vertical;
  min-height: 36px;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -1px;
  }
`;

// Appears between the controls and the table while rows are selected.
const BulkBar = styled.section`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

const BulkCount = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

const BulkSelect = styled.select`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

// Destructive per DESIGN.md: outline with red text, never one-click.
const DangerButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.negative};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  cursor: pointer;
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
`;

const DialogTitle = styled.h3`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
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
  accounts: LedgerAccount[];
  uncategorizedCount: number;
  transfersEnabled: boolean;
};

export function Ledger({
  page,
  query,
  categories: initialCategories,
  accounts: initialAccounts,
  uncategorizedCount,
  transfersEnabled,
}: LedgerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Local mirror of the server-rendered rows so mutations can apply
  // optimistically; re-adopted whenever the server re-renders the page.
  const [items, setItems] = useState<LedgerTransaction[]>(page.items);
  const [search, setSearch] = useState(query.search);
  // Optimistic mirror of the URL filter so the switch flips instantly while
  // the navigation round-trips.
  const [uncatChecked, setUncatChecked] = useState(query.onlyUncategorized);
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Which row's detail panel (kept import columns + editable note) is open.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const { onlyUncategorized, sortColumn, sortDir } = query;

  // Adopt fresh server data whenever the rendered page changes — a URL
  // navigation, or a revalidation after a mutation. Stale row selections are
  // dropped with it.
  useEffect(() => {
    setItems(page.items);
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    setCategories(initialCategories);
    setAccounts(initialAccounts);
  }, [initialCategories, initialAccounts]);

  // Keep the search box and filter switch in step with the URL (e.g.
  // back/forward navigation).
  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    setUncatChecked(query.onlyUncategorized);
  }, [query.onlyUncategorized]);

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
    updateParams({ q: value.trim() || null, page: null }, "replace");
  }, 300);

  const onSearch = (value: string) => {
    setSearch(value);
    runSearch(value);
  };

  const onToggleUncategorized = (checked: boolean) => {
    setUncatChecked(checked);
    updateParams({ uncat: checked ? "1" : null, page: null }, "replace");
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

  const totalPages = pageCount(page.total);

  const goToPage = (n: number) =>
    updateParams({ page: n <= 1 ? null : String(n) }, "push");

  // Optimistically reflect a category assignment; clears any transfer. Drops the
  // row if it no longer matches the "uncategorized only" filter.
  const applyAssignment = (transactionId: string, categoryId: string | null) =>
    setItems((prev) =>
      onlyUncategorized && categoryId !== null
        ? prev.filter((t) => t.id !== transactionId)
        : prev.map((t) =>
            t.id === transactionId
              ? { ...t, categoryId, transferAccountId: null }
              : t,
          ),
    );

  // Optimistically reflect a transfer; clears any category. A transfer is no
  // longer "uncategorized", so drop it under that filter.
  const applyTransfer = (transactionId: string, accountId: string) =>
    setItems((prev) =>
      onlyUncategorized
        ? prev.filter((t) => t.id !== transactionId)
        : prev.map((t) =>
            t.id === transactionId
              ? { ...t, transferAccountId: accountId, categoryId: null }
              : t,
          ),
    );

  const onSelect = (transactionId: string, categoryId: string | null) => {
    applyAssignment(transactionId, categoryId);
    startTransition(async () => {
      await setTransactionCategory({ transactionId, categoryId });
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
      const created = await createAccount({ name });
      setAccounts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      applyTransfer(transactionId, created.id);
      await setTransactionTransfer({ transactionId, accountId: created.id });
    });
  };

  const onCreateAndAssign = (
    transactionId: string,
    input: NewCategoryInput,
  ) => {
    startTransition(async () => {
      const created = await createCategory(input);
      setCategories((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
        ),
      );
      applyAssignment(transactionId, created.id);
      await setTransactionCategory({
        transactionId,
        categoryId: created.id,
      });
    });
  };

  const sortMark = (key: SortColumn) =>
    sortColumn === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  const allOnPageSelected =
    items.length > 0 && items.every((t) => selected.has(t.id));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected(
      allOnPageSelected ? new Set() : new Set(items.map((t) => t.id)),
    );

  // Applies a category to every selected row, optimistically, then commits in
  // one server round-trip. Mirrors the single-row behaviour under the
  // "uncategorized only" filter: newly categorised rows leave the list.
  const onBulkCategorise = (value: string) => {
    const categoryId = value === "__clear__" ? null : value;
    const ids = Array.from(selected);
    setItems((prev) =>
      onlyUncategorized && categoryId !== null
        ? prev.filter((t) => !selected.has(t.id))
        : prev.map((t) =>
            selected.has(t.id)
              ? { ...t, categoryId, transferAccountId: null }
              : t,
          ),
    );
    setSelected(new Set());
    startTransition(async () => {
      await bulkSetTransactionCategory({ transactionIds: ids, categoryId });
    });
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

  const onBulkDelete = () => {
    const ids = Array.from(selected);
    setItems((prev) => prev.filter((t) => !selected.has(t.id)));
    setSelected(new Set());
    setConfirmDelete(false);
    startTransition(async () => {
      await bulkDeleteTransactions({ transactionIds: ids });
    });
  };

  return (
    <Section>
      <Head>
        <Title>Transactions</Title>
        {uncategorizedCount > 0 && (
          <Nudge>
            {uncategorizedCount} uncategorized — assign a category below
          </Nudge>
        )}
      </Head>

      <Controls>
        <Toggle>
          <SwitchInput
            type="checkbox"
            checked={uncatChecked}
            onChange={(e) => onToggleUncategorized(e.target.checked)}
          />
          <SwitchTrack />
          Uncategorized only
        </Toggle>
        <Search
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search description…"
        />
      </Controls>

      {selected.size > 0 && (
        <BulkBar aria-label="Bulk actions">
          <BulkCount>{selected.size} selected</BulkCount>
          <BulkSelect
            value=""
            onChange={(e) => onBulkCategorise(e.target.value)}
            aria-label="Set category for selected transactions"
          >
            <option value="" disabled>
              Set category…
            </option>
            <option value="__clear__">— Uncategorized —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.section}
              </option>
            ))}
          </BulkSelect>
          <DangerButton type="button" onClick={() => setConfirmDelete(true)}>
            Delete…
          </DangerButton>
          <GhostButton type="button" onClick={() => setSelected(new Set())}>
            Clear selection
          </GhostButton>
        </BulkBar>
      )}

      {items.length === 0 ? (
        <Empty>
          {onlyUncategorized || search
            ? "No transactions match."
            : "No transactions yet — import a statement above."}
        </Empty>
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <ThCheck>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all transactions on this page"
                  />
                </ThCheck>
                {COLUMNS.map((col) => (
                  <Th
                    key={col.key}
                    $align={col.align}
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortMark(col.key)}
                  </Th>
                ))}
                <ThCheck aria-label="Notes" />
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <Fragment key={tx.id}>
                  <tr>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={() => toggleRow(tx.id)}
                        aria-label={`Select ${tx.description}`}
                      />
                    </Td>
                    <Td>{tx.date.slice(0, 10)}</Td>
                    <Td>{tx.description}</Td>
                    <Td>{tx.accountName}</Td>
                    <Amount $negative={tx.amount < 0}>
                      {tx.amount.toFixed(2)}
                    </Amount>
                    <Td>
                      <CategoryCombobox
                        categories={categories}
                        accounts={accounts}
                        value={tx.categoryId}
                        transferAccountId={tx.transferAccountId}
                        ownAccountId={tx.accountId}
                        defaultType={tx.amount < 0 ? "EXPENSE" : "INCOME"}
                        transfersEnabled={transfersEnabled}
                        onSelect={(categoryId) => onSelect(tx.id, categoryId)}
                        onCreate={(input) => onCreateAndAssign(tx.id, input)}
                        onTransfer={(accountId) => onTransfer(tx.id, accountId)}
                        onCreateAccount={(name) =>
                          onCreateAccountAndTransfer(tx.id, name)
                        }
                      />
                    </Td>
                    <Td>
                      <NoteToggle
                        type="button"
                        $has={Boolean(tx.note || tx.extra)}
                        aria-expanded={expandedId === tx.id}
                        onClick={() => toggleExpanded(tx)}
                      >
                        {tx.note ? "Note ●" : tx.extra ? "Details" : "+ Note"}
                      </NoteToggle>
                    </Td>
                  </tr>
                  {expandedId === tx.id && (
                    <tr>
                      <DetailTd colSpan={7}>
                        <DetailPanel>
                          {tx.extra ? (
                            <>
                              <ExtraList>
                                {Object.entries(tx.extra).map(
                                  ([key, value]) => (
                                    <ExtraPair key={key}>
                                      <ExtraKey>{key}</ExtraKey>
                                      {value}
                                    </ExtraPair>
                                  ),
                                )}
                              </ExtraList>
                              <DetailHint>
                                Showing only the columns ticked under “Also
                                keep” when this statement was imported.
                              </DetailHint>
                            </>
                          ) : (
                            <DetailHint>
                              No kept import columns — tick columns under “Also
                              keep” when importing to store them here.
                            </DetailHint>
                          )}
                          <NoteRow>
                            <NoteArea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Add a note…"
                              aria-label={`Note for ${tx.description}`}
                            />
                            <GhostButton
                              type="button"
                              onClick={() => saveNote(tx.id)}
                            >
                              Save
                            </GhostButton>
                            <GhostButton
                              type="button"
                              onClick={() => setExpandedId(null)}
                            >
                              Cancel
                            </GhostButton>
                          </NoteRow>
                        </DetailPanel>
                      </DetailTd>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
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
              <GhostButton
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                Keep them
              </GhostButton>
              <DangerButton type="button" onClick={onBulkDelete}>
                Delete {selected.size} transaction(s)
              </DangerButton>
            </DialogActions>
          </Dialog>
        </Overlay>
      )}
    </Section>
  );
}

"use client";

import { Button } from "@/components/ui/Button";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import type {
  LedgerCategory,
  LedgerPage,
  LedgerTransaction,
  SortColumn,
  SortDir,
} from "@/lib/transactions/server";
import { useEffect, useRef, useState, useTransition } from "react";
import styled from "styled-components";
import { CategoryCombobox, type NewCategoryInput } from "./CategoryCombobox";
import {
  bulkDeleteTransactions,
  bulkSetTransactionCategory,
  createAccount,
  createCategory,
  loadMoreTransactions,
  setTransactionCategory,
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
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
  initialPage: LedgerPage;
  categories: LedgerCategory[];
  accounts: LedgerAccount[];
  uncategorizedCount: number;
  transfersEnabled: boolean;
};

export function Ledger({
  initialPage,
  categories: initialCategories,
  accounts: initialAccounts,
  uncategorizedCount,
  transfersEnabled,
}: LedgerProps) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<LedgerTransaction[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialPage.nextOffset,
  );
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Latest client query, mirrored into a ref so the re-sync effect can read it
  // without depending on (and re-firing for) every filter/search/sort change.
  const queryRef = useRef({ search, onlyUncategorized, sortColumn, sortDir });
  queryRef.current = { search, onlyUncategorized, sortColumn, sortDir };

  // Re-sync when the server re-renders this component with fresh props (e.g.
  // after an import, or after categorising revalidates the route). `initialPage`
  // is always the server's *unfiltered* first page, so if a client filter /
  // search / non-default sort is active we re-run that query instead of adopting
  // initialPage — otherwise a revalidation would flash the full list back in
  // while the filter is still on. With no active query, adopt initialPage
  // directly (the import case). The prop reference only changes on a server
  // refresh/navigation, not on this component's own state updates.
  useEffect(() => {
    setCategories(initialCategories);
    setAccounts(initialAccounts);

    const q = queryRef.current;
    const filtered =
      q.onlyUncategorized ||
      q.search.trim() !== "" ||
      q.sortColumn !== "date" ||
      q.sortDir !== "desc";

    if (filtered) {
      startTransition(async () => {
        const page = await loadMoreTransactions({ offset: 0, ...q });
        setItems(page.items);
        setNextOffset(page.nextOffset);
      });
      return;
    }

    setItems(initialPage.items);
    setNextOffset(initialPage.nextOffset);
  }, [initialPage, initialCategories, initialAccounts]);

  // Loads page from `offset`. Replaces the list unless appending more.
  const load = (
    over: {
      offset?: number;
      search?: string;
      onlyUncategorized?: boolean;
      sortColumn?: SortColumn;
      sortDir?: SortDir;
    },
    append: boolean,
  ) => {
    const query = {
      offset: 0,
      search,
      onlyUncategorized,
      sortColumn,
      sortDir,
      ...over,
    };
    // A fresh page invalidates the current selection; appending keeps it.
    if (!append) setSelected(new Set());
    startTransition(async () => {
      const page = await loadMoreTransactions(query);
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextOffset(page.nextOffset);
    });
  };

  const runSearch = useDebouncedCallback((value: string) => {
    load({ offset: 0, search: value }, false);
  }, 300);

  const onSearch = (value: string) => {
    setSearch(value);
    runSearch(value);
  };

  const onToggleUncategorized = (checked: boolean) => {
    setOnlyUncategorized(checked);
    load({ offset: 0, onlyUncategorized: checked }, false);
  };

  const onSort = (key: SortColumn) => {
    const dir: SortDir =
      sortColumn === key && sortDir === "desc" ? "asc" : "desc";
    setSortColumn(key);
    setSortDir(dir);
    load({ offset: 0, sortColumn: key, sortDir: dir }, false);
  };

  const onLoadMore = () => {
    if (nextOffset === null) return;
    load({ offset: nextOffset }, true);
  };

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
            checked={onlyUncategorized}
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
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => (
              <tr key={tx.id}>
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
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {nextOffset !== null && (
        <div>
          <Button type="button" onClick={onLoadMore} disabled={pending}>
            {pending ? "Loading…" : "Load more"}
          </Button>
        </div>
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

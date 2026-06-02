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
import { useEffect, useState, useTransition } from "react";
import styled from "styled-components";
import { CategoryCombobox, type NewCategoryInput } from "./CategoryCombobox";
import {
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

  // Re-sync from the server when it re-renders this component with fresh props
  // (e.g. after an import calls router.refresh()) — otherwise the initial
  // useState snapshot would hide newly-imported rows until a full reload. The
  // prop reference only changes on a server refresh/navigation, not on this
  // component's own state updates, so client interactions aren't clobbered.
  useEffect(() => {
    setItems(initialPage.items);
    setNextOffset(initialPage.nextOffset);
    setCategories(initialCategories);
    setAccounts(initialAccounts);
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
    </Section>
  );
}

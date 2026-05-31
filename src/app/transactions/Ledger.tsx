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
import { useState, useTransition } from "react";
import styled from "styled-components";
import {
  createCategory,
  loadMoreTransactions,
  setTransactionCategory,
} from "./actions";

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

const Th = styled.th<{ $sortable?: boolean; $align?: "right" }>`
  text-align: ${({ $align }) => ($align === "right" ? "right" : "left")};
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.dim};
  font-weight: 600;
  cursor: ${({ $sortable }) => ($sortable ? "pointer" : "default")};
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

const Select = styled.select`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  max-width: 220px;
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const NewCategory = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const EXPENSE_BUCKETS = [
  { value: "FIXED", label: "Fixed" },
  { value: "VARIABLE", label: "Variable" },
  { value: "DISCRETIONARY", label: "Discretionary" },
] as const;

const INCOME_BUCKETS = [
  { value: "SALARY", label: "Salary" },
  { value: "SIDE_INCOME", label: "Side income" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "PENSIONS", label: "Pensions" },
  { value: "OTHER", label: "Other" },
] as const;

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
  uncategorizedCount: number;
};

export function Ledger({
  initialPage,
  categories: initialCategories,
  uncategorizedCount,
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
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newBucket, setNewBucket] = useState<string>(EXPENSE_BUCKETS[0].value);

  const bucketOptions =
    newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS;

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

  const onAssign = (transactionId: string, categoryId: string) => {
    const value = categoryId === "" ? null : categoryId;
    setItems((prev) =>
      onlyUncategorized && value !== null
        ? prev.filter((t) => t.id !== transactionId)
        : prev.map((t) =>
            t.id === transactionId ? { ...t, categoryId: value } : t,
          ),
    );
    startTransition(async () => {
      await setTransactionCategory({ transactionId, categoryId: value });
    });
  };

  const onChangeNewType = (type: "EXPENSE" | "INCOME") => {
    setNewType(type);
    setNewBucket(
      (type === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0].value,
    );
  };

  const onCreateCategory = () => {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const created = await createCategory({
        label,
        type: newType,
        bucket: newBucket,
      });
      setCategories((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
        ),
      );
      setNewLabel("");
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

      <NewCategory>
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New category…"
        />
        <Select
          value={newType}
          onChange={(e) =>
            onChangeNewType(e.target.value as "EXPENSE" | "INCOME")
          }
        >
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </Select>
        <Select
          value={newBucket}
          onChange={(e) => setNewBucket(e.target.value)}
        >
          {bucketOptions.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
        <Button type="button" onClick={onCreateCategory} disabled={pending}>
          Add category
        </Button>
      </NewCategory>

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
                  $sortable
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
                  <Select
                    value={tx.categoryId ?? ""}
                    onChange={(e) => onAssign(tx.id, e.target.value)}
                  >
                    <option value="">— Uncategorized —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.type === "INCOME" ? "in" : "out"})
                      </option>
                    ))}
                  </Select>
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

"use client";

import { Button } from "@/components/ui/Button";
import type {
  LedgerCategory,
  LedgerPage,
  LedgerTransaction,
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

const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.dim};
  font-weight: 600;
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
  const [cursor, setCursor] = useState<string | null>(initialPage.nextCursor);
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  const refetch = (uncategorized: boolean) => {
    startTransition(async () => {
      const page = await loadMoreTransactions({
        cursor: null,
        onlyUncategorized: uncategorized,
      });
      setItems(page.items);
      setCursor(page.nextCursor);
    });
  };

  const onToggleFilter = (checked: boolean) => {
    setOnlyUncategorized(checked);
    refetch(checked);
  };

  const onLoadMore = () => {
    startTransition(async () => {
      const page = await loadMoreTransactions({ cursor, onlyUncategorized });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  };

  const onAssign = (transactionId: string, categoryId: string) => {
    const value = categoryId === "" ? null : categoryId;
    // Optimistic update; drop the row if it no longer matches the filter.
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

  const onCreateCategory = () => {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const created = await createCategory({ label, type: newType });
      setCategories((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label),
        ),
      );
      setNewLabel("");
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
        <Check>
          <input
            type="checkbox"
            checked={onlyUncategorized}
            onChange={(e) => onToggleFilter(e.target.checked)}
          />
          Show uncategorized only
        </Check>
        <span style={{ flex: 1 }} />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New category…"
        />
        <Select
          value={newType}
          onChange={(e) => setNewType(e.target.value as "EXPENSE" | "INCOME")}
        >
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </Select>
        <Button type="button" onClick={onCreateCategory} disabled={pending}>
          Add category
        </Button>
      </Controls>

      {items.length === 0 ? (
        <Empty>
          {onlyUncategorized
            ? "No uncategorized transactions."
            : "No transactions yet — import a statement above."}
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th>Account</Th>
              <Th style={{ textAlign: "right" }}>Amount</Th>
              <Th>Category</Th>
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

      {cursor && (
        <div>
          <Button type="button" onClick={onLoadMore} disabled={pending}>
            {pending ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </Section>
  );
}

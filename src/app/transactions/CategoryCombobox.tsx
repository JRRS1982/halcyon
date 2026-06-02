"use client";

import { EXPENSE_BUCKETS, INCOME_BUCKETS } from "@/lib/categories/buckets";
import type { LedgerCategory } from "@/lib/transactions/server";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

const Wrap = styled.div`
  position: relative;
  display: inline-block;
  min-width: 200px;
`;

const Trigger = styled.button`
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    cursor: default;
    color: ${({ theme }) => theme.colors.dim};
  }
`;

const Muted = styled.span`
  color: ${({ theme }) => theme.colors.dim};
`;

const Popover = styled.div`
  position: absolute;
  z-index: 30;
  top: calc(100% + 2px);
  left: 0;
  width: 280px;
  max-width: 80vw;
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const SearchInput = styled.input`
  width: 100%;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  outline: none;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
`;

const Option = styled.li`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.canvasSoft};
  }
`;

const OptionMeta = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;

const CreatePanel = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

const CreateLine = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`;

const MiniSelect = styled.select`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const CreateButton = styled.button`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.accent};
  color: #fff;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  cursor: pointer;
`;

export type NewCategoryInput = {
  label: string;
  type: "EXPENSE" | "INCOME";
  bucket: string;
};

export type LedgerAccount = { id: string; name: string };

type Props = {
  categories: LedgerCategory[];
  accounts: LedgerAccount[];
  value: string | null;
  transferAccountId: string | null;
  ownAccountId: string;
  defaultType: "EXPENSE" | "INCOME";
  transfersEnabled: boolean;
  disabled?: boolean;
  onSelect: (categoryId: string | null) => void;
  onCreate: (input: NewCategoryInput) => void;
  onTransfer: (accountId: string) => void;
  onCreateAccount: (name: string) => void;
};

export function CategoryCombobox({
  categories,
  accounts,
  value,
  transferAccountId,
  ownAccountId,
  defaultType,
  transfersEnabled,
  disabled,
  onSelect,
  onCreate,
  onTransfer,
  onCreateAccount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"category" | "transfer">("category");
  const [query, setQuery] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">(defaultType);
  const [newBucket, setNewBucket] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const current = categories.find((c) => c.id === value) ?? null;
  const transferAccount =
    accounts.find((a) => a.id === transferAccountId) ?? null;
  const trimmed = query.trim();
  const matches = trimmed
    ? categories.filter((c) =>
        c.label.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : categories;
  const exact = categories.some(
    (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exact;

  // Transfer panel: pickable accounts exclude the transaction's own account.
  const transferable = accounts.filter((a) => a.id !== ownAccountId);
  const accountMatches = trimmed
    ? transferable.filter((a) =>
        a.name.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : transferable;
  const accountExact = transferable.some(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreateAccount = trimmed.length > 0 && !accountExact;

  const bucketOptions =
    newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setPanel("category");
    setQuery("");
  };

  const choose = (categoryId: string | null) => {
    onSelect(categoryId);
    close();
  };

  const chooseAccount = (accountId: string) => {
    onTransfer(accountId);
    close();
  };

  const startCreate = () => {
    setNewType(defaultType);
    setNewBucket(
      (defaultType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0].value,
    );
  };

  const submitCreate = () => {
    const bucket =
      newBucket ||
      (newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0].value;
    onCreate({ label: trimmed, type: newType, bucket });
    close();
  };

  const submitCreateAccount = () => {
    onCreateAccount(trimmed);
    close();
  };

  // Sign decides the arrow: negative leaves this account (→), positive arrives (←).
  const transferArrow = defaultType === "EXPENSE" ? "→" : "←";

  return (
    <Wrap
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <Trigger
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {current ? (
          <>
            {current.label} <Muted>· {current.section}</Muted>
          </>
        ) : transferAccount ? (
          <>
            <Muted>Transfer {transferArrow}</Muted> {transferAccount.name}
          </>
        ) : (
          <Muted>— Uncategorized —</Muted>
        )}
      </Trigger>

      {open && (
        <Popover>
          <SearchInput
            ref={inputRef}
            value={query}
            placeholder={
              panel === "transfer"
                ? "Search or create an account…"
                : "Type to search or create…"
            }
            onChange={(e) => {
              setQuery(e.target.value);
              if (panel === "category") startCreate();
            }}
          />

          {panel === "category" ? (
            <>
              <List>
                {value !== null && (
                  <Option
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(null)}
                  >
                    <span>— Uncategorized —</span>
                  </Option>
                )}
                {transfersEnabled && (
                  <Option
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPanel("transfer");
                      setQuery("");
                    }}
                  >
                    <span>Transfer ▸</span>
                    <OptionMeta>to / from an account</OptionMeta>
                  </Option>
                )}
                {matches.map((c) => (
                  <Option
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(c.id)}
                  >
                    <span>{c.label}</span>
                    <OptionMeta>
                      {c.section} · {c.type === "INCOME" ? "in" : "out"}
                    </OptionMeta>
                  </Option>
                ))}
                {matches.length === 0 && !canCreate && (
                  <Option as="li" style={{ cursor: "default" }}>
                    <Muted>No matches</Muted>
                  </Option>
                )}
              </List>

              {canCreate && (
                <CreatePanel>
                  <span style={{ fontSize: 13 }}>
                    Create <strong>“{trimmed}”</strong> in:
                  </span>
                  <CreateLine>
                    <MiniSelect
                      value={newType}
                      onChange={(e) => {
                        const t = e.target.value as "EXPENSE" | "INCOME";
                        setNewType(t);
                        setNewBucket(
                          (t === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0]
                            .value,
                        );
                      }}
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </MiniSelect>
                    <MiniSelect
                      value={newBucket}
                      onChange={(e) => setNewBucket(e.target.value)}
                    >
                      {bucketOptions.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </MiniSelect>
                  </CreateLine>
                  <CreateButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitCreate}
                  >
                    Create &amp; assign
                  </CreateButton>
                </CreatePanel>
              )}
            </>
          ) : (
            <>
              <List>
                <Option
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPanel("category");
                    setQuery("");
                  }}
                >
                  <Muted>◂ Back to categories</Muted>
                </Option>
                {accountMatches.map((a) => (
                  <Option
                    key={a.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseAccount(a.id)}
                  >
                    <span>{a.name}</span>
                    <OptionMeta>{transferArrow}</OptionMeta>
                  </Option>
                ))}
                {accountMatches.length === 0 && !canCreateAccount && (
                  <Option as="li" style={{ cursor: "default" }}>
                    <Muted>
                      {transferable.length === 0
                        ? "No accounts yet — type a name to create one"
                        : "No matches"}
                    </Muted>
                  </Option>
                )}
              </List>

              {canCreateAccount && (
                <CreatePanel>
                  <span style={{ fontSize: 13 }}>
                    Create account <strong>“{trimmed}”</strong>
                  </span>
                  <CreateButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitCreateAccount}
                  >
                    Create &amp; assign
                  </CreateButton>
                </CreatePanel>
              )}
            </>
          )}
        </Popover>
      )}
    </Wrap>
  );
}

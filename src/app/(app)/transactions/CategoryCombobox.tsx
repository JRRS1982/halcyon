"use client";

import { EXPENSE_BUCKETS, INCOME_BUCKETS } from "@/lib/categories/buckets";
import type { LedgerCategory } from "@/lib/transactions/server";
import { useEffect, useId, useRef, useState } from "react";
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
  max-height: 260px;
  overflow-y: auto;
`;

const GroupHeading = styled.li`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.dim};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

const Option = styled.li<{ $active?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.canvasSoft : "transparent"};

  &:hover {
    background: ${({ theme }) => theme.colors.canvasSoft};
  }
`;

// One colour per option kind, so the eye can split income / spend / transfers
// without reading the metadata column.
export type OptionTone = "income" | "expense" | "transfer";

const OptionLabel = styled.span<{ $tone?: OptionTone }>`
  color: ${({ $tone, theme }) =>
    $tone === "income"
      ? theme.colors.positive
      : $tone === "expense"
        ? theme.colors.negative
        : $tone === "transfer"
          ? theme.colors.accent
          : theme.colors.ink};
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
  // Account(s) the shown transaction(s) belong to; excluded as transfer
  // targets for a single row, kept but skipped server-side for bulk.
  ownAccountId: string;
  defaultType: "EXPENSE" | "INCOME";
  transfersEnabled: boolean;
  disabled?: boolean;
  // Trigger text when nothing is chosen; defaults to "— Uncategorized —".
  placeholder?: string;
  // Offer the "— Uncategorized —" clear option even when value is null (the
  // bulk bar always shows it: a mixed selection can still be cleared).
  alwaysClearable?: boolean;
  // Accessible name for the trigger button (e.g. the bulk bar's purpose).
  triggerLabel?: string;
  onSelect: (categoryId: string | null) => void;
  onCreate: (input: NewCategoryInput) => void;
  onTransfer: (accountId: string) => void;
  onCreateAccount: (name: string) => void;
};

// A row the keyboard can land on, in render order. `label`/`tone`/`meta`
// drive the <Option> below; `run` is what Enter or a click does.
type NavOption = {
  key: string;
  label: React.ReactNode;
  tone?: OptionTone;
  meta?: string;
  run: () => void;
};

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label);
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

export function CategoryCombobox({
  categories,
  accounts,
  value,
  transferAccountId,
  ownAccountId,
  defaultType,
  transfersEnabled,
  disabled,
  placeholder = "— Uncategorized —",
  alwaysClearable = false,
  triggerLabel,
  onSelect,
  onCreate,
  onTransfer,
  onCreateAccount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Index into the keyboard-navigable options below; -1 means none highlighted.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">(defaultType);
  const [newBucket, setNewBucket] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const current = categories.find((c) => c.id === value) ?? null;
  const transferAccount =
    accounts.find((a) => a.id === transferAccountId) ?? null;
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const matching = trimmed
    ? categories.filter((c) => c.label.toLowerCase().includes(needle))
    : categories;
  const incomeMatches = matching
    .filter((c) => c.type === "INCOME")
    .sort(byLabel);
  const expenseMatches = matching
    .filter((c) => c.type === "EXPENSE")
    .sort(byLabel);
  const exact = categories.some((c) => c.label.toLowerCase() === needle);
  const canCreate = trimmed.length > 0 && !exact;

  // Transfer targets exclude the transaction's own account.
  const transferable = transfersEnabled
    ? accounts.filter((a) => a.id !== ownAccountId).sort(byName)
    : [];
  const accountMatches = trimmed
    ? transferable.filter((a) => a.name.toLowerCase().includes(needle))
    : transferable;
  const accountExact = transferable.some(
    (a) => a.name.toLowerCase() === needle,
  );
  const canCreateAccount =
    transfersEnabled && trimmed.length > 0 && !accountExact;

  const bucketOptions =
    newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted option visible as arrow keys move it.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-opt-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listboxId]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const choose = (categoryId: string | null) => {
    onSelect(categoryId);
    close();
  };

  const chooseAccount = (accountId: string) => {
    onTransfer(accountId);
    close();
  };

  // Sign decides the direction word: an outflow is a transfer "to" the other
  // account, an inflow is a transfer "from" it.
  const transferWord = defaultType === "EXPENSE" ? "to" : "from";

  // One flat list: clear, then the three colour-coded groups, each
  // alphabetical, plus the inline create-account row when nothing matches.
  const groups: { heading: string | null; options: NavOption[] }[] = [
    {
      heading: null,
      options:
        value !== null || alwaysClearable
          ? [
              {
                key: "__clear__",
                label: <span>— Uncategorized —</span>,
                run: () => choose(null),
              },
            ]
          : [],
    },
    {
      heading: "Income",
      options: incomeMatches.map((c) => ({
        key: c.id,
        label: <OptionLabel $tone="income">{c.label}</OptionLabel>,
        meta: c.section,
        run: () => choose(c.id),
      })),
    },
    {
      heading: "Expenses",
      options: expenseMatches.map((c) => ({
        key: c.id,
        label: <OptionLabel $tone="expense">{c.label}</OptionLabel>,
        meta: c.section,
        run: () => choose(c.id),
      })),
    },
    {
      heading: "Transfers",
      options: [
        ...accountMatches.map((a) => ({
          key: a.id,
          label: <OptionLabel $tone="transfer">{a.name}</OptionLabel>,
          meta: `transfer ${transferWord}`,
          run: () => chooseAccount(a.id),
        })),
        ...(canCreateAccount
          ? [
              {
                key: "__new_account__",
                label: (
                  <OptionLabel $tone="transfer">
                    ＋ New account “{trimmed}”
                  </OptionLabel>
                ),
                meta: `transfer ${transferWord}`,
                run: () => {
                  onCreateAccount(trimmed);
                  close();
                },
              },
            ]
          : []),
      ],
    },
  ];
  const navOptions = groups.flatMap((g) => g.options);
  const nothingMatches = navOptions.length === 0;

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (navOptions.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => {
        if (i === -1) return delta === 1 ? 0 : navOptions.length - 1;
        return (i + delta + navOptions.length) % navOptions.length;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const active = navOptions[activeIndex];
      if (active) {
        active.run();
        return;
      }
      // No highlight: a typed query commits its first match — categories
      // before transfer accounts — otherwise the popup just closes.
      const first = incomeMatches[0] ?? expenseMatches[0];
      if (trimmed && first) {
        choose(first.id);
        return;
      }
      if (trimmed && accountMatches[0]) {
        chooseAccount(accountMatches[0].id);
        return;
      }
      close();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
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

  // Options are rendered per group but keyboard-indexed across the whole
  // list, so ids must advance with a running offset.
  let renderedIndex = -1;

  return (
    <Wrap
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <Trigger
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {current ? (
          <>
            {current.label} <Muted>· {current.section}</Muted>
          </>
        ) : transferAccount ? (
          <>
            <Muted>Transfer {transferWord}</Muted> {transferAccount.name}
          </>
        ) : (
          <Muted>{placeholder}</Muted>
        )}
      </Trigger>

      {open && (
        <Popover>
          <SearchInput
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
            }
            placeholder="Type to search or create…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              startCreate();
            }}
            onKeyDown={onSearchKeyDown}
          />

          {/* biome-ignore lint/a11y/useSemanticElements: WAI-ARIA combobox pattern; a native <select> cannot host the search/create UI */}
          <List id={listboxId} role="listbox">
            {groups.map((group) => {
              if (group.options.length === 0) return null;
              return (
                <li key={group.heading ?? "__top__"} role="presentation">
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {group.heading && (
                      <GroupHeading role="presentation">
                        {group.heading}
                      </GroupHeading>
                    )}
                    {group.options.map((option) => {
                      renderedIndex += 1;
                      const index = renderedIndex;
                      return (
                        <Option
                          key={option.key}
                          id={`${listboxId}-opt-${index}`}
                          // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA combobox pattern; a native <select> cannot host the search/create UI
                          role="option"
                          aria-selected={activeIndex === index}
                          $active={activeIndex === index}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={option.run}
                        >
                          {option.label}
                          {option.meta && (
                            <OptionMeta>{option.meta}</OptionMeta>
                          )}
                        </Option>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {nothingMatches && !canCreate && (
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
        </Popover>
      )}
    </Wrap>
  );
}

// The ledger's filter drawer: date range, account, category and amount, on the
// shared Drawer chrome (centred dialog on desktop, bottom sheet on a phone).
//
// The drawer holds a draft and writes the URL once, on Apply. Six controls
// each navigating on change would round-trip the server six times to reach one
// state; the toolbar's search and uncategorized toggle stay live because they
// are single gestures.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { Drawer, DrawerSection, Field } from "@/components/ui/Drawer";
import { datePresets } from "@/lib/transactions/dateRanges";
import type { LedgerUrlQuery } from "@/lib/transactions/pagination";
import type { LedgerCategory } from "@/lib/transactions/server";

const Input = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Select = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Presets = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PresetButton = styled.button`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.full};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.body};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.hairlineStrong};
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const FootButton = styled.button<{ $primary?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid
    ${({ $primary, theme }) =>
      $primary ? theme.colors.ink : theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.ink : theme.colors.canvas};
  color: ${({ $primary, theme }) =>
    $primary ? theme.colors.canvas : theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  cursor: pointer;
`;

type Account = { id: string; name: string };

// The draft, in the shape the form fields speak: every value a string, because
// that is what an <input> and a <select> hold. It converts back to URL params
// on Apply, where an empty field simply means "unset".
type Draft = {
  onlyUncategorized: boolean;
  from: string;
  to: string;
  accountId: string;
  category: string;
  amountMin: string;
  amountMax: string;
};

const TRANSFERS = "transfers";

const draftFrom = (query: LedgerUrlQuery): Draft => ({
  onlyUncategorized: query.onlyUncategorized,
  from: query.from ?? "",
  to: query.to ?? "",
  accountId: query.accountId ?? "",
  category:
    query.category.kind === "any"
      ? ""
      : query.category.kind === "transfers"
        ? TRANSFERS
        : query.category.categoryId,
  amountMin: query.amountMin === null ? "" : String(query.amountMin),
  amountMax: query.amountMax === null ? "" : String(query.amountMax),
});

const EMPTY_DRAFT: Draft = {
  onlyUncategorized: false,
  from: "",
  to: "",
  accountId: "",
  category: "",
  amountMin: "",
  amountMax: "",
};

// A blank field clears its param rather than sending an empty string, so a
// cleared filter leaves no trace in the URL.
const paramsFrom = (draft: Draft): Record<string, string | null> => ({
  uncat: draft.onlyUncategorized ? "1" : null,
  from: draft.from || null,
  to: draft.to || null,
  acct: draft.accountId || null,
  cat: draft.category || null,
  min: draft.amountMin || null,
  max: draft.amountMax || null,
});

export function FilterDrawer({
  open,
  query,
  accounts,
  categories,
  transfersEnabled,
  onClose,
  onApply,
}: {
  open: boolean;
  query: LedgerUrlQuery;
  accounts: Account[];
  categories: LedgerCategory[];
  /** With transfers off there is nothing to filter for, so the option is hidden. */
  transfersEnabled: boolean;
  onClose: () => void;
  onApply: (params: Record<string, string | null>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(query));
  const uncategorizedId = useId();

  // Re-seed from the URL each time the drawer *opens*, so an abandoned edit is
  // discarded rather than waiting to surprise the next person to open it.
  //
  // Keyed on `open` alone, and `query` is deliberately read through a ref: it
  // is a fresh object on every server render, so depending on it would re-seed
  // mid-edit whenever a background revalidation landed — wiping whatever was
  // being typed.
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    if (open) setDraft(draftFrom(queryRef.current));
  }, [open]);

  const set = (patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <Drawer
      open={open}
      eyebrow="Narrow the ledger"
      title="Filters"
      onClose={onClose}
      footer={
        <>
          <FootButton
            type="button"
            onClick={() => onApply(paramsFrom(EMPTY_DRAFT))}
          >
            Clear all
          </FootButton>
          <FootButton
            type="button"
            $primary
            onClick={() => onApply(paramsFrom(draft))}
          >
            Apply
          </FootButton>
        </>
      }
    >
      {/* First, because it is the filter people reach for most — it moved in
          here from the toolbar, and appears as a chip so it is never hidden
          state. */}
      <DrawerSection title="Status" defaultOpen>
        <Field label="Uncategorized only" htmlFor={uncategorizedId}>
          <input
            id={uncategorizedId}
            type="checkbox"
            checked={draft.onlyUncategorized}
            onChange={(e) => set({ onlyUncategorized: e.target.checked })}
          />
        </Field>
      </DrawerSection>

      <DrawerSection title="Date" defaultOpen>
        <Presets>
          {datePresets(new Date()).map((preset) => (
            <PresetButton
              key={preset.label}
              type="button"
              onClick={() => set({ from: preset.from, to: preset.to })}
            >
              {preset.label}
            </PresetButton>
          ))}
        </Presets>
        <Pair>
          <Field label="From">
            <Input
              type="date"
              value={draft.from}
              onChange={(e) => set({ from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={draft.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </Field>
        </Pair>
      </DrawerSection>

      <DrawerSection title="Account" defaultOpen>
        <Field label="Account">
          <Select
            value={draft.accountId}
            onChange={(e) => set({ accountId: e.target.value })}
          >
            <option value="">Any account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
      </DrawerSection>

      <DrawerSection title="Category" defaultOpen>
        <Field label="Category">
          <Select
            value={draft.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="">Any category</option>
            {transfersEnabled ? (
              <option value={TRANSFERS}>Transfers</option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>
      </DrawerSection>

      {/* Amounts are signed in the ledger but matched on magnitude here, so a
          single pair of bounds covers "£40 either way" — see ledgerWhere. */}
      <DrawerSection title="Amount" defaultOpen>
        <Pair>
          <Field label="Minimum">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.amountMin}
              onChange={(e) => set({ amountMin: e.target.value })}
            />
          </Field>
          <Field label="Maximum">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.amountMax}
              onChange={(e) => set({ amountMax: e.target.value })}
            />
          </Field>
        </Pair>
      </DrawerSection>
    </Drawer>
  );
}

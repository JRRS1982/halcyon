"use client";

import { Button } from "@/components/ui/Button";
import type { LedgerCategory } from "@/lib/transactions/server";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import styled from "styled-components";
import { createTransaction } from "./actions";

type Account = { id: string; name: string };

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: rgba(0, 0, 0, 0.4);
`;

const Dialog = styled.dialog`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 420px;
  margin: auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  position: static;
`;

const DialogTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;

const Select = styled.select`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;

// Money out / Money in as a two-button toggle: typing minus signs on a phone
// keyboard is exactly the friction this dialog exists to remove.
const Direction = styled.fieldset`
  border: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DirectionLegend = styled.legend`
  padding: 0;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

const DirectionRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DirectionButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.canvas};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onPrimary : theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  cursor: pointer;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
`;

const ErrorText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;

const Toast = styled.output`
  position: fixed;
  right: ${({ theme }) => theme.spacing["2xl"]};
  bottom: ${({ theme }) => theme.spacing["2xl"]};
  z-index: 60;
  padding: ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  box-shadow: rgba(15, 17, 22, 0.08) 0px 4px 12px 0px;
`;

const todayIso = () => new Date().toISOString().slice(0, 10);

// One typed-in transaction — cash spend, a mid-month capture — without waiting
// for the next statement export. The complement of ImportPanel, not a rival:
// statements stay the bulk path.
export function QuickAdd({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: LedgerCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");

  // Categories grouped the way the ledger's combobox groups them — by the
  // budget section they roll up into.
  const grouped = useMemo(() => {
    const bySection = new Map<string, LedgerCategory[]>();
    for (const category of categories) {
      const list = bySection.get(category.section) ?? [];
      list.push(category);
      bySection.set(category.section, list);
    }
    return [...bySection.entries()];
  }, [categories]);

  const reset = () => {
    setDate(todayIso());
    setDescription("");
    setAmount("");
    setDirection("out");
    setCategoryId("");
    setError(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const magnitude = Number(amount);
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    startTransition(async () => {
      try {
        await createTransaction({
          accountId,
          date,
          description,
          amount: direction === "out" ? -magnitude : magnitude,
          categoryId: categoryId || null,
        });
        setOpen(false);
        setSaved(description.trim());
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  if (accounts.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setSaved(null);
          setOpen(true);
        }}
      >
        Add transaction
      </Button>

      {open && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <Dialog open aria-label="Add a transaction">
            <DialogTitle>Add a transaction</DialogTitle>
            <form onSubmit={onSubmit}>
              <FormGrid>
                <Direction>
                  <DirectionLegend>Direction</DirectionLegend>
                  <DirectionRow>
                    <DirectionButton
                      type="button"
                      $active={direction === "out"}
                      onClick={() => setDirection("out")}
                    >
                      Money out
                    </DirectionButton>
                    <DirectionButton
                      type="button"
                      $active={direction === "in"}
                      onClick={() => setDirection("in")}
                    >
                      Money in
                    </DirectionButton>
                  </DirectionRow>
                </Direction>
                <Field>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Field>
                  <Label>Description</Label>
                  <Input
                    type="text"
                    required
                    maxLength={300}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Corner cafe"
                  />
                </Field>
                <Field>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field>
                  <Label>Account</Label>
                  <Select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Category</Label>
                  <Select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Uncategorised — decide later</option>
                    {grouped.map(([section, list]) => (
                      <optgroup key={section} label={section}>
                        {list.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                {error && <ErrorText>{error}</ErrorText>}
                <Actions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Add"}
                  </Button>
                </Actions>
              </FormGrid>
            </form>
          </Dialog>
        </Overlay>
      )}

      {saved && <Toast aria-live="polite">Added &ldquo;{saved}&rdquo;.</Toast>}
    </>
  );
}

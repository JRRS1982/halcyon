"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useTransition } from "react";
import styled from "styled-components";

const Shell = styled.main`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
`;

const FieldLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: ${({ theme }) => theme.typography.monoCaps.textTransform};
  color: ${({ theme }) => theme.colors.dim};
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
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

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const SavedNote = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: ${({ theme }) => theme.typography.monoCaps.textTransform};
  color: ${({ theme }) => theme.colors.dim};
`;

const ToggleField = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
  cursor: pointer;
`;

const Checkbox = styled.input`
  margin-top: 3px;
`;

const ToggleText = styled.span`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FieldHint = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 52ch;
`;

type SelectOption = { value: string; label: string };

export function SettingsForm({
  action,
  currency,
  currencyOptions,
  numberFormat,
  numberFormatOptions,
  transactionsEnabled,
}: {
  action: (formData: FormData) => Promise<void>;
  currency: string;
  currencyOptions: SelectOption[];
  numberFormat: string;
  numberFormatOptions: SelectOption[];
  transactionsEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const onSubmit = (formData: FormData) => {
    setJustSaved(false);
    startTransition(async () => {
      await action(formData);
      setJustSaved(true);
    });
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        lead="App-wide preferences for your account."
      />
      <form action={onSubmit}>
        <Field>
          <FieldLabel>Currency</FieldLabel>
          <Select name="currency" defaultValue={currency}>
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel>Number format</FieldLabel>
          <Select name="numberFormat" defaultValue={numberFormat}>
            {numberFormatOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <ToggleField>
          <Checkbox
            type="checkbox"
            name="transactionsEnabled"
            defaultChecked={transactionsEnabled}
          />
          <ToggleText>
            <FieldLabel>Transactions</FieldLabel>
            <FieldHint>
              Show the Transactions page and import bank statements. When on,
              each budget category’s actual is summed from its categorized
              transactions instead of being typed by hand.
            </FieldHint>
          </ToggleText>
        </ToggleField>
        <Row>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {justSaved && !pending && <SavedNote>Saved</SavedNote>}
        </Row>
      </form>
    </Shell>
  );
}

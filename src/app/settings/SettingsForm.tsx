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

type CurrencyOption = { code: string; label: string };

export function SettingsForm({
  action,
  currency,
  currencyOptions,
}: {
  action: (formData: FormData) => Promise<void>;
  currency: string;
  currencyOptions: CurrencyOption[];
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
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
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

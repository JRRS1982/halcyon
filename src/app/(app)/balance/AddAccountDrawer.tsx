"use client";

import type { AccountKind, AccountSection } from "@prisma/client";
import { type ReactNode, useRef, useState, useTransition } from "react";
import styled from "styled-components";
import { AccountTermsFields } from "@/components/accounts/AccountTermsFields";
import { Button } from "@/components/ui/Button";
import { Drawer, DrawerSection } from "@/components/ui/Drawer";
import {
  ACCOUNT_TYPES,
  type AccountDraft,
  type AccountTypeId,
  accountTypeById,
  canSubmitAccountDraft,
  defaultCanImportTransactions,
  termsFor,
} from "@/lib/accounts/accountDraft";
import type { AccountTermsInput } from "@/lib/accounts/schemas";
import { summariseTerms } from "@/lib/accounts/termsSummary";
import { isValidBalanceCategory } from "@/lib/balance/reorder";
import { accountSectionSchema } from "@/lib/balance/schemas";
import { createAccount } from "./accountActions";

// Display labels for the five balance-sheet sections — the same wording
// BalanceSheet.tsx uses for its own subheads (CATEGORIES, BalanceSheet.tsx:87-91),
// so the drawer's "Section" field reads as the destination the user already
// sees, not the schema's internal TERM vocabulary.
const SECTION_LABELS: Record<AccountSection, string> = {
  CURRENT: "Current",
  MEDIUM_TERM: "Medium-term",
  LONG_TERM: "Long-term",
  PROPERTY: "Property",
  OTHER: "Other",
};

// PROPERTY is asset-only, so a liability's Section field never offers it —
// shares isValidBalanceCategory with BalanceSheet.tsx's own section picker
// and its rendered subheads rather than re-stating the same rule here too.
function sectionOptionsFor(type: AccountKind): AccountSection[] {
  return accountSectionSchema.options.filter((c) =>
    isValidBalanceCategory(type, c),
  );
}

// ─── Form fields ────────────────────────────────────────────────────────────
//
// The dialog/scrim/focus-trap chrome itself now lives in the shared
// `Drawer` (src/components/ui/Drawer.tsx) rather than a copy kept local to
// this feature. What's left here is this form's own field layout and inputs.

// Fills Drawer's scrollable body with this form's own padding/grid — Drawer's
// Body only supplies flex sizing and overflow, not field layout.
const FormBody = styled.form`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const FieldWrap = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;
const TextInput = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  padding: ${({ theme }) => theme.spacing.sm};
  font: inherit;
`;
const Select = styled.select`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  padding: ${({ theme }) => theme.spacing.sm};
  font: inherit;
`;
const CheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
`;
const MortgageFields = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
`;
const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FieldWrap>
      {label}
      {children}
    </FieldWrap>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AddAccountDrawer({
  open,
  year,
  month,
  onClose,
  onCreated,
}: {
  open: boolean;
  year: number;
  month: number;
  onClose: () => void;
  onCreated: (result: { periodId: string; accountId: string }) => void;
}) {
  const [typeId, setTypeId] = useState<AccountTypeId | null>(null);
  const [category, setCategory] = useState<AccountSection | null>(null);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  // Follows the account type, and is not asked about here. Whether a SIPP can
  // take a CSV is not a decision worth making while naming one, and the answer
  // is the same for everyone with that type — Settings lists every account with
  // its own switch for the rare case where the default is wrong.
  const canImportTransactions = defaultCanImportTransactions(
    accountTypeById(typeId)?.kind ?? "ASSET",
    accountTypeById(typeId)?.wrapper ?? null,
  );
  const [sectionTouched, setSectionTouched] = useState(false);
  const [hasMortgage, setHasMortgage] = useState(false);
  const [mortgageName, setMortgageName] = useState("");
  const [mortgageValue, setMortgageValue] = useState("");
  const [terms, setTerms] = useState<AccountTermsInput>({});
  const [mortgageTerms, setMortgageTerms] = useState<AccountTermsInput>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // One picked type answers asset-or-liability and the tax wrapper both — see
  // ACCOUNT_TYPES. `kind` is what the drawer's own fields branch on; the
  // payload sends the type itself and the server derives the rest.
  const accountType = accountTypeById(typeId);
  const type: AccountKind | null = accountType?.kind ?? null;
  const isProperty = accountType?.id === "PROPERTY";

  const selectAccountType = (next: AccountTypeId) => {
    const option = accountTypeById(next);
    if (!option) return;
    // The section follows the type unless the user has chosen one themselves —
    // a default, not an inference, and their choice sticks once made.
    //
    // PROPERTY is asset-only, so a section the user picked that is no longer
    // valid for this type falls back to the type's default rather than being
    // silently kept.
    const keepsChoice =
      sectionTouched &&
      category !== null &&
      isValidBalanceCategory(option.kind, category);
    const nextCategory = keepsChoice ? category : option.defaultSection;
    setTypeId(next);
    setCategory(nextCategory);
    // The name is always the next thing typed, and until a type is picked the
    // field does not exist to be focused — so it is focused here rather than
    // left for the user to reach for.
    queueMicrotask(() => nameRef.current?.focus());

    // The mortgage question belongs to the Property type, not the section, so
    // leaving Property clears it.
    if (option.id !== "PROPERTY") {
      setHasMortgage(false);
    }
  };

  // The section no longer affects the import default — that is keyed on the
  // wrapper, which the account type already fixed — so this only records the
  // choice, and the fact that it was the user's rather than the default.
  const selectCategory = (next: AccountSection) => {
    setSectionTouched(true);
    setCategory(next);
  };

  const draft: AccountDraft = {
    type,
    category,
    name,
    value,
    hasMortgage,
    mortgageName,
    mortgageValue,
  };
  const canSubmit = canSubmitAccountDraft(draft);

  const resetForm = () => {
    setTypeId(null);
    setCategory(null);
    setName("");
    setValue("");

    setSectionTouched(false);
    setHasMortgage(false);
    setMortgageName("");
    setMortgageValue("");
    setTerms({});
    setMortgageTerms({});
    setError(null);
  };

  // Every way of leaving the drawer without submitting — the × button, the
  // Cancel button, Esc, and clicking the scrim — clears the draft too, so
  // reopening starts blank rather than showing what was typed last time.
  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !typeId || !category) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createAccount({
          year,
          month,
          name,
          // The one thing the user picked. kind and wrapper are derived from
          // it server-side rather than sent alongside it.
          type: typeId,
          section: category,
          value: Number(value),
          canImportTransactions,
          terms,
          mortgage: hasMortgage
            ? {
                name: mortgageName,
                value: Number(mortgageValue),
                // No import toggle offered for the mortgage half — it mirrors
                // the liability default (defaultCanImportTransactions never
                // returns true for a LIABILITY) rather than exposing a second
                // checkbox the brief doesn't ask for.
                canImportTransactions: false,
                terms: mortgageTerms,
              }
            : null,
        });
        onCreated(result);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add account");
      }
    });
  };

  return (
    <Drawer
      open={open}
      eyebrow="Balance sheet"
      title="Add an account"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-account-form"
            disabled={!canSubmit || pending}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </>
      }
    >
      <FormBody onSubmit={handleSubmit} id="add-account-form">
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Field label="What are you adding?">
          <Select
            value={typeId ?? ""}
            onChange={(e) => selectAccountType(e.target.value as AccountTypeId)}
          >
            <option value="" disabled>
              Choose…
            </option>
            <optgroup label="Assets">
              {ACCOUNT_TYPES.filter((o) => o.kind === "ASSET").map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Liabilities">
              {ACCOUNT_TYPES.filter((o) => o.kind === "LIABILITY").map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>

        {type && typeId ? (
          <>
            <Field label="Name">
              <TextInput
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={accountType?.namePlaceholder ?? "Name"}
              />
            </Field>

            <Field label="Section">
              <Select
                value={category ?? ""}
                onChange={(e) =>
                  selectCategory(e.target.value as AccountSection)
                }
              >
                {sectionOptionsFor(type).map((c) => (
                  <option key={c} value={c}>
                    {SECTION_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Value now">
              <TextInput
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            {termsFor(typeId).length > 0 ? (
              <DrawerSection
                title="Advanced"
                summary={summariseTerms(typeId, terms)}
              >
                <AccountTermsFields
                  type={typeId}
                  value={terms}
                  onChange={setTerms}
                />
              </DrawerSection>
            ) : null}

            {isProperty ? (
              <>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={hasMortgage}
                    onChange={(e) => setHasMortgage(e.target.checked)}
                  />
                  Is there a mortgage on it?
                </CheckboxLabel>
                {hasMortgage ? (
                  <MortgageFields>
                    <Field label="Mortgage name">
                      <TextInput
                        value={mortgageName}
                        onChange={(e) => setMortgageName(e.target.value)}
                        placeholder="e.g. Halifax mortgage"
                      />
                    </Field>
                    <Field label="Mortgage value now">
                      <TextInput
                        inputMode="decimal"
                        value={mortgageValue}
                        onChange={(e) => setMortgageValue(e.target.value)}
                        placeholder="0.00"
                      />
                    </Field>
                    <DrawerSection
                      title="Advanced"
                      summary={summariseTerms("MORTGAGE", mortgageTerms)}
                    >
                      <AccountTermsFields
                        type="MORTGAGE"
                        value={mortgageTerms}
                        onChange={setMortgageTerms}
                      />
                    </DrawerSection>
                  </MortgageFields>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </FormBody>
    </Drawer>
  );
}

"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import {
  type AccountDraft,
  canSubmitAccountDraft,
  resolveCanImportTransactions,
} from "@/lib/accounts/accountDraft";
import {
  accountWrapperSchema,
  type CreateAccountWithBalanceInput,
} from "@/lib/accounts/schemas";
import {
  type BalanceCategory,
  type BalanceType,
  isValidBalanceCategory,
} from "@/lib/balance/reorder";
import { balanceItemCategorySchema } from "@/lib/balance/schemas";
import { createAccountWithBalance } from "./accountActions";

type Wrapper = CreateAccountWithBalanceInput["wrapper"];

// Display labels for the five balance-sheet sections — the same wording
// BalanceSheet.tsx uses for its own subheads (CATEGORIES, BalanceSheet.tsx:87-91),
// so the drawer's "Section" field reads as the destination the user already
// sees, not the schema's internal TERM vocabulary.
const SECTION_LABELS: Record<BalanceCategory, string> = {
  CURRENT: "Current",
  MEDIUM_TERM: "Medium-term",
  LONG_TERM: "Long-term",
  PROPERTY: "Property",
  OTHER: "Other",
};

// PROPERTY is asset-only, so a liability's Section field never offers it —
// shares isValidBalanceCategory with BalanceSheet.tsx's own section picker
// and its rendered subheads rather than re-stating the same rule here too.
function sectionOptionsFor(type: BalanceType): BalanceCategory[] {
  return balanceItemCategorySchema.options.filter((c) =>
    isValidBalanceCategory(type, c),
  );
}

// ─── Chrome (adapted from plan/PlanDrawer.tsx: same dialog/scrim/focus-trap
// pattern, kept local to this feature rather than imported cross-feature) ──

const Scrim = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 22, 0.22);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition: opacity 0.2s ease;
  z-index: 40;
`;

// A native <dialog>, rendered purely with CSS rather than showModal()/open —
// see the identical note on plan/PlanDrawer.tsx's Sheet for why.
const Sheet = styled.dialog<{ $open: boolean }>`
  position: fixed;
  top: 50%;
  left: 50%;
  width: min(460px, 94vw);
  max-height: min(88vh, 720px);
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 24px 64px rgba(15, 17, 22, 0.22);
  transform: translate(-50%, -50%) scale(${({ $open }) => ($open ? "1" : "0.98")});
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: 767px) {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 85dvh;
    border: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
    border-radius: ${({ theme }) => theme.rounded.sm} ${({ theme }) => theme.rounded.sm} 0 0;
    box-shadow: 0 -16px 48px rgba(15, 17, 22, 0.22);
    transform: translateY(${({ $open }) => ($open ? "0%" : "100%")});
  }
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;
const Eyebrow = styled.div`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;
const Title = styled.h2`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;
const CloseBtn = styled.button`
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.dim};
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.rounded.sm};
  &:hover {
    color: ${({ theme }) => theme.colors.ink};
    background: ${({ theme }) => theme.colors.canvasSoft};
  }
`;
const Body = styled.form`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  background: ${({ theme }) => theme.colors.canvasSoft};

  @media (max-width: 767px) {
    padding-bottom: calc(${({ theme }) => theme.spacing.md} + env(safe-area-inset-bottom));
  }
`;

// ─── Form fields ────────────────────────────────────────────────────────────

const RadioFieldset = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const RadioLegend = styled.legend`
  padding: 0 0 ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;
const RadioRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const RadioLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
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
  const sheetRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const typeGroupName = useId();

  const [type, setType] = useState<BalanceType | null>(null);
  const [category, setCategory] = useState<BalanceCategory | null>(null);
  const [name, setName] = useState("");
  const [wrapper, setWrapper] = useState<Wrapper>("OTHER");
  const [value, setValue] = useState("");
  const [canImportTransactions, setCanImportTransactions] = useState(false);
  const [importTouched, setImportTouched] = useState(false);
  const [hasMortgage, setHasMortgage] = useState(false);
  const [mortgageName, setMortgageName] = useState("");
  const [mortgageValue, setMortgageValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectType = (next: BalanceType) => {
    // PROPERTY is asset-only — switching to LIABILITY while it's selected
    // leaves no valid option selected, so the section resets rather than
    // silently keeping an invalid value.
    const nextCategory =
      next === "LIABILITY" && category === "PROPERTY" ? null : category;
    setType(next);
    setCategory(nextCategory);
    setCanImportTransactions((current) =>
      resolveCanImportTransactions(current, importTouched, next, nextCategory),
    );
    if (nextCategory !== category) {
      setHasMortgage(false);
    }
  };

  const selectCategory = (next: BalanceCategory) => {
    setCategory(next);
    if (type) {
      setCanImportTransactions((current) =>
        resolveCanImportTransactions(current, importTouched, type, next),
      );
    }
    if (next !== "PROPERTY") {
      setHasMortgage(false);
    }
  };

  const toggleImport = (checked: boolean) => {
    setImportTouched(true);
    setCanImportTransactions(checked);
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
    setType(null);
    setCategory(null);
    setName("");
    setWrapper("OTHER");
    setValue("");
    setCanImportTransactions(false);
    setImportTouched(false);
    setHasMortgage(false);
    setMortgageName("");
    setMortgageValue("");
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
    if (!canSubmit || !type || !category) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createAccountWithBalance({
          year,
          month,
          name,
          type,
          category,
          wrapper,
          value: Number(value),
          canImportTransactions,
          mortgage: hasMortgage
            ? {
                name: mortgageName,
                value: Number(mortgageValue),
                // No import toggle offered for the mortgage half — it mirrors
                // the liability default (defaultCanImportTransactions never
                // returns true for a LIABILITY) rather than exposing a second
                // checkbox the brief doesn't ask for.
                canImportTransactions: false,
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

  // While open: Esc closes; Tab is trapped within the sheet; body scroll is
  // locked; focus moves into the sheet. On close, focus returns to the
  // element that opened the drawer. Mirrors plan/PlanDrawer.tsx.
  const onCloseRef = useRef(handleClose);
  onCloseRef.current = handleClose;

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <Scrim $open={open} onClick={handleClose} aria-hidden="true" />
      <Sheet
        ref={sheetRef}
        $open={open}
        aria-labelledby={titleId}
        aria-modal={open || undefined}
        aria-hidden={!open}
        tabIndex={-1}
      >
        {open ? (
          <>
            <Head>
              <div>
                <Eyebrow>Balance sheet</Eyebrow>
                <Title id={titleId}>Add an account</Title>
              </div>
              <CloseBtn type="button" aria-label="Close" onClick={handleClose}>
                {"×"}
              </CloseBtn>
            </Head>
            <Body onSubmit={handleSubmit} id="add-account-form">
              {error ? <ErrorText>{error}</ErrorText> : null}
              <RadioFieldset>
                <RadioLegend>What are you adding?</RadioLegend>
                <RadioRow>
                  <RadioLabel>
                    <input
                      type="radio"
                      name={typeGroupName}
                      value="ASSET"
                      checked={type === "ASSET"}
                      onChange={() => selectType("ASSET")}
                    />
                    Asset
                  </RadioLabel>
                  <RadioLabel>
                    <input
                      type="radio"
                      name={typeGroupName}
                      value="LIABILITY"
                      checked={type === "LIABILITY"}
                      onChange={() => selectType("LIABILITY")}
                    />
                    Liability
                  </RadioLabel>
                </RadioRow>
              </RadioFieldset>

              {type ? (
                <>
                  <Field label="Name">
                    <TextInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Vanguard ISA"
                    />
                  </Field>

                  <Field label="Section">
                    <Select
                      value={category ?? ""}
                      onChange={(e) =>
                        selectCategory(e.target.value as BalanceCategory)
                      }
                    >
                      <option value="" disabled>
                        Choose…
                      </option>
                      {sectionOptionsFor(type).map((c) => (
                        <option key={c} value={c}>
                          {SECTION_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {type === "ASSET" ? (
                    <Field label="Wrapper">
                      <Select
                        value={wrapper}
                        onChange={(e) => setWrapper(e.target.value as Wrapper)}
                      >
                        {accountWrapperSchema.options.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}

                  <Field label="Value now">
                    <TextInput
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>

                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={canImportTransactions}
                      onChange={(e) => toggleImport(e.target.checked)}
                    />
                    Import statements to this account
                  </CheckboxLabel>

                  {type === "ASSET" && category === "PROPERTY" ? (
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
                        </MortgageFields>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </Body>
            <Foot>
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
            </Foot>
          </>
        ) : null}
      </Sheet>
    </>
  );
}

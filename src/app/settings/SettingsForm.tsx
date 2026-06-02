"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import styled from "styled-components";
import { SectionHeading } from "./SectionHeading";
import { toggleTransactions } from "./actions";

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
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
  cursor: pointer;
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

// Slide toggle: a visually-hidden checkbox drives the track via the adjacent-
// sibling selector, so it stays keyboard- and form-native while looking like a
// switch.
const SwitchInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
`;

const SwitchTrack = styled.span`
  position: relative;
  display: inline-block;
  flex: none;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.hairlineStrong};
  transition: background 0.15s ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.canvas};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
  }

  ${SwitchInput}:checked + & {
    background: ${({ theme }) => theme.colors.positive};
  }

  ${SwitchInput}:checked + &::after {
    transform: translateX(18px);
  }

  ${SwitchInput}:focus-visible + & {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const SwitchControl = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

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
  gap: ${({ theme }) => theme.spacing.xl};
  /* A native <dialog open> defaults to position: absolute + margin: auto,
     which drops it out of the Overlay's flexbox so it can't be centred.
     Reset to a normal flex child centred by the Overlay. */
  position: static;
  margin: 0;
  width: 100%;
  max-width: 380px;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: none;
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
`;

const DialogText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

const DialogInfo = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.body};

  strong {
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
`;

const GhostButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  cursor: pointer;
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
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [currencyValue, setCurrencyValue] = useState(currency);
  const [numberFormatValue, setNumberFormatValue] = useState(numberFormat);

  // Format changes persist immediately on change (no Save button): build the
  // form data from the current selections and call the action.
  const persistFormat = (nextCurrency: string, nextNumberFormat: string) => {
    const formData = new FormData();
    formData.set("currency", nextCurrency);
    formData.set("numberFormat", nextNumberFormat);
    setJustSaved(false);
    startSave(async () => {
      await action(formData);
      setJustSaved(true);
    });
  };

  // The transactions toggle persists immediately behind a confirm dialog.
  // `enabled` is the displayed state;
  // committedRef holds the last persisted value to revert to on cancel.
  const [enabled, setEnabled] = useState(transactionsEnabled);
  const committedRef = useRef(transactionsEnabled);
  const [confirming, setConfirming] = useState(false);
  const [togglePending, startToggle] = useTransition();

  // Changing the toggle optimistically moves it and opens the dialog; only
  // Confirm persists, Cancel reverts to the last committed value.
  const onToggle = (next: boolean) => {
    setEnabled(next);
    setConfirming(true);
  };
  const cancelToggle = () => {
    setEnabled(committedRef.current);
    setConfirming(false);
  };
  const confirmToggle = () => {
    setConfirming(false);
    const value = enabled;
    startToggle(async () => {
      await toggleTransactions(value);
      committedRef.current = value;
      router.refresh();
    });
  };

  const enabling = enabled && !committedRef.current;
  const disabling = !enabled && committedRef.current;

  return (
    <Shell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        lead="App-wide preferences for your account."
      />
      <SectionHeading>Format</SectionHeading>
      <Field>
        <FieldLabel>Currency</FieldLabel>
        <Select
          name="currency"
          value={currencyValue}
          disabled={savePending}
          onChange={(event) => {
            const next = event.target.value;
            setCurrencyValue(next);
            persistFormat(next, numberFormatValue);
          }}
        >
          {currencyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <FieldLabel>Number format</FieldLabel>
        <Select
          name="numberFormat"
          value={numberFormatValue}
          disabled={savePending}
          onChange={(event) => {
            const next = event.target.value;
            setNumberFormatValue(next);
            persistFormat(currencyValue, next);
          }}
        >
          {numberFormatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
      {(savePending || justSaved) && (
        <Row>
          <SavedNote>{savePending ? "Saving…" : "Saved"}</SavedNote>
        </Row>
      )}

      <SectionHeading>Transactions</SectionHeading>
      <ToggleField>
        <ToggleText>
          <FieldHint>
            Tracking every transaction gives you the deepest understanding of
            where your money actually goes — but it takes time and effort, and
            it’s entirely your choice whether that’s worth it. Turn this on to
            add the Transactions page and import bank statements; each budget
            category’s actual is then summed from its categorized transactions
            rather than typed by hand. Leave it off to keep entering actuals
            yourself.
          </FieldHint>
        </ToggleText>
        <SwitchControl>
          <SwitchInput
            type="checkbox"
            aria-label="Transactions"
            checked={enabled}
            disabled={togglePending}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <SwitchTrack />
        </SwitchControl>
      </ToggleField>

      {confirming && (
        <Overlay
          onClick={(event) => {
            if (event.target === event.currentTarget) cancelToggle();
          }}
        >
          <Dialog open>
            <DialogText>
              {enabling ? "Turn Transactions on?" : "Turn Transactions off?"}
            </DialogText>
            {enabling && (
              <DialogInfo>
                Adds the Transactions page to the nav, lets you import bank
                statements, and switches each budget category’s <em>actual</em>{" "}
                to the sum of its categorized transactions (the actual column
                becomes read-only). Your existing manual actuals are kept, not
                overwritten.
              </DialogInfo>
            )}
            {disabling && (
              <DialogInfo>
                Hides the Transactions page and makes the budget’s{" "}
                <em>actual</em> column editable again, showing your
                manually-entered values. Your imported transactions and
                categories are kept — they’ll reappear if you switch it back on.
              </DialogInfo>
            )}
            <DialogActions>
              <GhostButton type="button" onClick={cancelToggle}>
                Cancel
              </GhostButton>
              <Button
                type="button"
                onClick={confirmToggle}
                disabled={togglePending}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Overlay>
      )}
    </Shell>
  );
}

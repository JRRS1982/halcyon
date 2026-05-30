"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { type FormEvent, useRef, useState, useTransition } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // The toggle's intended value when the dialog opened, so we can explain the
  // consequence of the specific change (enable vs disable vs no change).
  const [nextTransactions, setNextTransactions] = useState(transactionsEnabled);

  // Saving is gated behind a confirmation: submitting the form opens the
  // dialog; only the dialog's Confirm actually runs the action.
  const requestSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setNextTransactions(new FormData(form).get("transactionsEnabled") === "on");
    setConfirming(true);
  };

  const enabling = nextTransactions && !transactionsEnabled;
  const disabling = !nextTransactions && transactionsEnabled;

  const confirmSave = () => {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setConfirming(false);
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
      <form ref={formRef} onSubmit={requestSave}>
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
          <ToggleText>
            <FieldLabel>Transactions</FieldLabel>
            <FieldHint>
              Show the Transactions page and import bank statements. When on,
              each budget category’s actual is summed from its categorized
              transactions instead of being typed by hand.
            </FieldHint>
          </ToggleText>
          <SwitchControl>
            <SwitchInput
              type="checkbox"
              name="transactionsEnabled"
              defaultChecked={transactionsEnabled}
            />
            <SwitchTrack />
          </SwitchControl>
        </ToggleField>
        <Row>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {justSaved && !pending && <SavedNote>Saved</SavedNote>}
        </Row>
      </form>

      {confirming && (
        <Overlay
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <Dialog open>
            <DialogText>Save these settings?</DialogText>
            {enabling && (
              <DialogInfo>
                <strong>Turning Transactions on:</strong> adds the Transactions
                page to the nav, lets you import bank statements, and switches
                each budget category’s <em>actual</em> to the sum of its
                categorized transactions (the actual column becomes read-only).
                Your existing manual actuals are kept, not overwritten.
              </DialogInfo>
            )}
            {disabling && (
              <DialogInfo>
                <strong>Turning Transactions off:</strong> hides the
                Transactions page and makes the budget’s <em>actual</em> column
                editable again, showing your manually-entered values. Your
                imported transactions and categories are kept — they’ll reappear
                if you switch it back on.
              </DialogInfo>
            )}
            <DialogActions>
              <GhostButton type="button" onClick={() => setConfirming(false)}>
                Cancel
              </GhostButton>
              <Button type="button" onClick={confirmSave}>
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Overlay>
      )}
    </Shell>
  );
}

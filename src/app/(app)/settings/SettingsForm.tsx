"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  REMINDER_DAY_LABELS,
  REMINDER_DAYS,
  type ReminderDay,
} from "@/lib/email/reminder";
import {
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/lib/settings/theme";
import {
  setMonthlyReminderDay,
  setThemePreference,
  toggleMonthlyReminder,
  toggleTransactions,
  toggleTransfers,
} from "./actions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

// A section, not the page's <main>. Settings renders five sibling blocks and
// this is only the first of them — as <main> it left the other four outside the
// landmark, so a screen reader jumping to the main content reached preferences
// and nothing else. The page now supplies one <main> around all five.
const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} 0;
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
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
  transfersEnabled,
  themePreference,
  monthlyReminderEnabled,
  monthlyReminderDay,
}: {
  action: (formData: FormData) => Promise<void>;
  currency: string;
  currencyOptions: SelectOption[];
  numberFormat: string;
  numberFormatOptions: SelectOption[];
  transactionsEnabled: boolean;
  transfersEnabled: boolean;
  themePreference: ThemePreference;
  monthlyReminderEnabled: boolean;
  monthlyReminderDay: number;
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

  // The transfers toggle persists immediately (low-risk; no confirm dialog). It
  // is subordinate to transactions — only meaningful when transactions is on.
  const [transfersOn, setTransfersOn] = useState(transfersEnabled);
  const [transfersPending, startTransfers] = useTransition();
  const onToggleTransfers = (next: boolean) => {
    setTransfersOn(next);
    startTransfers(async () => {
      await toggleTransfers(next);
      router.refresh();
    });
  };

  // Persists immediately like the other preferences. The scheme itself is
  // applied by the server on the next render (it writes data-theme onto
  // <html>), so there is no client-side theme state to keep in sync — which is
  // also why there is no flash on a fresh load.
  const [themeValue, setThemeValue] =
    useState<ThemePreference>(themePreference);
  const [themePending, startTheme] = useTransition();
  const onChangeTheme = (next: ThemePreference) => {
    setThemeValue(next);
    startTheme(async () => {
      await setThemePreference(next);
      router.refresh();
    });
  };

  // The reminder is the only thing the app does that reaches the user
  // unprompted, so it is opt-in and persists the moment it's switched — no Save
  // button standing between someone and turning email off.
  const [reminderOn, setReminderOn] = useState(monthlyReminderEnabled);
  const [reminderPending, startReminder] = useTransition();
  const onToggleReminder = (next: boolean) => {
    setReminderOn(next);
    startReminder(async () => {
      await toggleMonthlyReminder(next);
      router.refresh();
    });
  };

  const [reminderDay, setReminderDay] = useState(monthlyReminderDay);
  const [dayPending, startDay] = useTransition();
  const onChangeReminderDay = (next: ReminderDay) => {
    setReminderDay(next);
    startDay(async () => {
      await setMonthlyReminderDay(next);
      router.refresh();
    });
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        lead="App-wide preferences for your account."
      />
      <SettingsCard>
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
      </SettingsCard>

      <SettingsCard>
        <SectionHeading>Appearance</SectionHeading>
        <Field>
          <FieldLabel>Colour scheme</FieldLabel>
          <Select
            name="themePreference"
            value={themeValue}
            disabled={themePending}
            onChange={(event) =>
              onChangeTheme(event.target.value as ThemePreference)
            }
          >
            {THEME_PREFERENCES.map((preference) => (
              <option key={preference} value={preference}>
                {THEME_PREFERENCE_LABELS[preference]}
              </option>
            ))}
          </Select>
          <FieldHint>
            Match my system follows your device, and changes with it.
          </FieldHint>
        </Field>
      </SettingsCard>

      <SettingsCard>
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

        <ToggleField>
          <ToggleText>
            <FieldLabel>Transfers</FieldLabel>
            <FieldHint>
              Adds a Transfers section to the budget that totals money moved
              between your own accounts (e.g. Current → ISA) — kept out of
              income and expenses. Tag a transaction as a transfer from the
              Transactions page. Needs Transactions switched on.
            </FieldHint>
          </ToggleText>
          <SwitchControl>
            <SwitchInput
              type="checkbox"
              aria-label="Transfers"
              checked={transfersOn}
              disabled={transfersPending || !enabled}
              onChange={(event) => onToggleTransfers(event.target.checked)}
            />
            <SwitchTrack />
          </SwitchControl>
        </ToggleField>
      </SettingsCard>

      <SettingsCard>
        <SectionHeading>Reminders</SectionHeading>
        <ToggleField>
          <ToggleText>
            <FieldLabel>Monthly reminder email</FieldLabel>
            <FieldHint>
              One email a month saying your statement should be ready — nothing
              more. It carries no figures, no balances and no category names;
              your numbers stay behind your login. Off unless you turn it on,
              and every email has a one-click way out.
            </FieldHint>
          </ToggleText>
          <SwitchControl>
            <SwitchInput
              type="checkbox"
              aria-label="Monthly reminder email"
              checked={reminderOn}
              disabled={reminderPending}
              onChange={(event) => onToggleReminder(event.target.checked)}
            />
            <SwitchTrack />
          </SwitchControl>
        </ToggleField>

        {reminderOn && (
          <Field>
            <FieldLabel>Send on</FieldLabel>
            <Select
              name="monthlyReminderDay"
              value={String(reminderDay)}
              disabled={dayPending}
              onChange={(event) =>
                onChangeReminderDay(Number(event.target.value) as ReminderDay)
              }
            >
              {REMINDER_DAYS.map((day) => (
                <option key={day} value={day}>
                  {REMINDER_DAY_LABELS[day]}
                </option>
              ))}
            </Select>
            <FieldHint>
              Pick a day a few days after your statement usually closes, so
              there's something to import when it arrives.
            </FieldHint>
          </Field>
        )}
      </SettingsCard>

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

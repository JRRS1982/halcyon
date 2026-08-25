"use client";

import { useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { canConfirmDeletion, type DeletionMode } from "@/lib/accounts/deletion";
import { DEFAULT_CURRENCY, formatAmount } from "@/lib/settings/currency";
import { archiveAccount, deleteAccountEverywhere } from "./accountActions";

// The shape the panel needs from AccountDeletionCounts (src/lib/accounts/
// schemas.ts) — a subset, since the panel never surfaces transactions or
// importBatches in its copy. The partner's own counts are optional here
// because they only exist once accountDeletionCounts has resolved a link;
// the caller always supplies them for a real `linked` account.
export type DeleteAccountPanelCounts = {
  months: number;
  budgetRows: number;
  linked: {
    accountId: string;
    name: string;
    latestValue: number;
    months?: number;
    budgetRows?: number;
  } | null;
};

type DeleteAccountPanelProps = {
  accountId: string;
  name: string;
  counts: DeleteAccountPanelCounts;
  isProperty: boolean;
  onClose: () => void;
  onDone: () => void;
};

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.negative};
  border-radius: ${({ theme }) => theme.rounded.sm};
`;

const Title = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-weight: 600;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.negative};
`;

const Text = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const RadioFieldset = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const RadioOption = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const RadioLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
`;

const PartnerBlock = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
`;

const ConfirmField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ConfirmLabel = styled.label`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const ConfirmInput = styled.input`
  width: 240px;
  max-width: 100%;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Alert = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
`;

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The panel doesn't receive the user's currency/number-format settings (its
// props are just the account and its counts), so the partner's latest value
// renders in the app's default currency rather than the sheet's own.
const money = (n: number) => formatAmount(DEFAULT_CURRENCY, n);

export function DeleteAccountPanel({
  accountId,
  name,
  counts,
  isProperty,
  onClose,
  onDone,
}: DeleteAccountPanelProps) {
  const [mode, setMode] = useState<DeletionMode>("archive");
  const [alsoLinked, setAlsoLinked] = useState(isProperty);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { linked } = counts;
  const canSubmit = canConfirmDeletion(mode, confirmText) && !pending;

  const onSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      if (mode === "archive") {
        await archiveAccount({ accountId });
      } else {
        await deleteAccountEverywhere({ accountId, alsoLinked });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Box role="alertdialog" aria-label={`Delete "${name}"`}>
      <Title>Delete &ldquo;{name}&rdquo;?</Title>

      <RadioFieldset>
        <RadioOption>
          <RadioLabel>
            <input
              type="radio"
              name="delete-mode"
              checked={mode === "archive"}
              onChange={() => setMode("archive")}
            />
            Stop tracking it
          </RadioLabel>
          <Text>
            Keeps the {counts.months} months of history already recorded. {name}{" "}
            leaves next month&rsquo;s sheet and the pickers, and can be restored
            from Settings.
          </Text>
        </RadioOption>

        <RadioOption>
          <RadioLabel>
            <input
              type="radio"
              name="delete-mode"
              checked={mode === "everywhere"}
              onChange={() => setMode("everywhere")}
            />
            Delete it everywhere
          </RadioLabel>
          <Text>
            Removes all {counts.months} monthly values, and the{" "}
            {counts.budgetRows} budget transfers pointing at it. This
            can&rsquo;t be undone.
          </Text>
        </RadioOption>
      </RadioFieldset>

      {linked && mode === "everywhere" && (
        <PartnerBlock>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={alsoLinked}
              onChange={(e) => setAlsoLinked(e.target.checked)}
            />
            Also delete &quot;{linked.name}&quot;
          </CheckboxLabel>
          <Text>Currently valued at {money(linked.latestValue)}.</Text>
          {mode === "everywhere" && alsoLinked && (
            <Text>
              Also removes {plural(linked.months ?? 0, "monthly value")} and the{" "}
              {plural(linked.budgetRows ?? 0, "budget transfer")} for &ldquo;
              {linked.name}&rdquo;.
            </Text>
          )}
        </PartnerBlock>
      )}

      {isProperty && (
        <Text>
          Sold it? Record a property sale on your plan instead — deleting loses
          the proceeds from your history.
        </Text>
      )}

      {mode === "everywhere" && (
        <ConfirmField>
          <ConfirmLabel htmlFor="confirm-delete-account">
            Type DELETE to confirm
          </ConfirmLabel>
          <ConfirmInput
            id="confirm-delete-account"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label={`Type DELETE to confirm deleting "${name}"`}
          />
        </ConfirmField>
      )}

      {error && <Alert role="alert">{error}</Alert>}

      <Actions>
        <Button
          type="button"
          variant="destructive"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Delete
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
      </Actions>
    </Box>
  );
}

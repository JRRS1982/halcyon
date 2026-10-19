"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import type { Reauthentication, ReauthMethod } from "@/lib/auth/reauth";
import { REAUTH_MESSAGES } from "@/lib/auth/reauthOutcome";
import {
  clearMyData,
  deleteMyAccount,
  exportMyData,
  resetToDefaults,
  sendReauthCode,
} from "./dataActions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["5xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const GroupText = styled.span`
  flex: 1;
  min-width: 200px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

// Inline confirmation panel shown after the user clicks Clear or Delete. Both
// destructive actions route through this so the consequence is spelled out and
// a second, deliberate action is required (mirrors the inline-confirm pattern
// in AccountManager).
const WarningBox = styled.div`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.negative};
  border-radius: ${({ theme }) => theme.rounded.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

// The export's panel. Same shape as WarningBox, without the red border: an
// export is sensitive, not destructive, and borrowing the destructive styling
// would cry wolf on the two panels that really are irreversible.
const ConfirmBox = styled(WarningBox)`
  border-color: ${({ theme }) => theme.colors.hairline};
`;

const WarningTitle = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-weight: 600;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.negative};
`;

const WarningText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
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
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
`;

type Mode = "export" | "reset" | "clear" | "delete" | null;

// The actions name their refusal and REAUTH_MESSAGES holds the words, so
// nothing here reads an error message: see lib/auth/reauthOutcome.ts for why
// a thrown message cannot survive the trip in a production build.
//
// A thrown error now means the action could not run at all, which is not a
// rule the user broke and not something a more specific message would help.
const UNREACHABLE = "Couldn't reach the server. Please try again.";

export function DataPrivacy({ method }: { method: ReauthMethod | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [confirmText, setConfirmText] = useState("");
  const [secret, setSecret] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (next: Mode) => {
    setError(null);
    setConfirmText("");
    setSecret("");
    setMode(next);
  };

  const cancel = () => {
    setConfirmText("");
    setSecret("");
    setMode(null);
  };

  // The panel collects one secret; which kind it is was decided server-side
  // from the account's identities, not guessed here.
  const proof = (): Reauthentication =>
    method === "password"
      ? { method: "password", password: secret }
      : { method: "otp", code: secret };

  // Unclassifiable: no control is rendered, so `secret` stays empty and every
  // confirm button stays disabled. Fail-closed by construction rather than by
  // a guard someone could forget.

  const onSendCode = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await sendReauthCode();
        if (!result.ok) {
          setError(REAUTH_MESSAGES[result.reason]);
          return;
        }
        setCodeSent(true);
      } catch {
        setError(UNREACHABLE);
      }
    });

  const onExport = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await exportMyData(proof());
        if (!result.ok) {
          setError(REAUTH_MESSAGES[result.reason]);
          return;
        }
        const blob = new Blob([result.json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `halcyon-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMode(null);
      } catch {
        setError(UNREACHABLE);
      }
    });

  const onReset = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await resetToDefaults(proof());
        if (!result.ok) {
          setError(REAUTH_MESSAGES[result.reason]);
          return;
        }
        setMode(null);
        router.refresh();
      } catch {
        setError(UNREACHABLE);
      }
    });

  const onClear = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await clearMyData(proof());
        if (!result.ok) {
          setError(REAUTH_MESSAGES[result.reason]);
          return;
        }
        setMode(null);
        router.refresh();
      } catch {
        setError(UNREACHABLE);
      }
    });

  const onDelete = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await deleteMyAccount(proof());
        // On success deleteMyAccount redirects, so only a refusal returns.
        if (!result.ok) setError(REAUTH_MESSAGES[result.reason]);
      } catch {
        setError(UNREACHABLE);
      }
    });

  // A plain function, not a nested component: a component defined inside the
  // render would remount on every keystroke and drop the input's focus.
  const renderProof = () =>
    method === null ? (
      <ConfirmField>
        <GroupText>
          We can&rsquo;t confirm it&rsquo;s you right now. Sign out and back in,
          and if this keeps happening, get in touch.
        </GroupText>
      </ConfirmField>
    ) : method === "password" ? (
      <ConfirmField>
        <ConfirmLabel htmlFor="reauth-secret">
          Enter your password to confirm
        </ConfirmLabel>
        <ConfirmInput
          id="reauth-secret"
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Your password"
        />
      </ConfirmField>
    ) : codeSent ? (
      <ConfirmField>
        <ConfirmLabel htmlFor="reauth-secret">
          Enter the code we emailed you
        </ConfirmLabel>
        <ConfirmInput
          id="reauth-secret"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="6-digit code"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onSendCode}
          disabled={pending}
        >
          Send another code
        </Button>
      </ConfirmField>
    ) : (
      <ConfirmField>
        <GroupText>
          Your account doesn&rsquo;t have a password, so we&rsquo;ll email you a
          one-time code to confirm it&rsquo;s you.
        </GroupText>
        <Button
          type="button"
          variant="outline"
          onClick={onSendCode}
          disabled={pending}
        >
          Email me a code
        </Button>
      </ConfirmField>
    );

  return (
    <Shell>
      <SettingsCard>
        <SectionHeading>Your data</SectionHeading>
        <Lead>
          Export, clear, or delete the data Halcyon holds about you. Export and
          clear affect only your financial records. Deleting your account is
          permanent and removes everything, including your login.
        </Lead>

        <Group>
          <GroupText>
            Download everything Halcyon stores about you as JSON.
          </GroupText>
          <Button
            type="button"
            variant="outline"
            onClick={() => start("export")}
            disabled={pending}
          >
            Export my data
          </Button>
        </Group>

        {mode === "export" ? (
          <ConfirmBox role="dialog" aria-label="Confirm data export">
            <WarningTitle>Confirm it&rsquo;s you</WarningTitle>
            <WarningText>
              The file contains everything Halcyon holds about you — every
              balance, transaction and plan. Anyone who can open it can read
              your finances, so we ask who you are first.
            </WarningText>
            {renderProof()}
            <Actions>
              <Button
                type="button"
                variant="primary"
                onClick={onExport}
                disabled={pending || !secret}
              >
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={pending}
              >
                Cancel
              </Button>
            </Actions>
          </ConfirmBox>
        ) : null}

        {mode === "reset" ? (
          <WarningBox role="alertdialog" aria-label="Confirm reset to defaults">
            <WarningTitle>⚠ Start again from the defaults?</WarningTitle>
            <WarningText>
              Every account, budget and balance goes — past months included —
              along with your transactions, imports, categories and plans. The
              starter categories, accounts and an empty budget for this month
              are put back, exactly as they were on your first day. Your login
              and settings stay. This can&rsquo;t be undone.
            </WarningText>
            {renderProof()}
            <Actions>
              <Button
                type="button"
                variant="destructive"
                onClick={onReset}
                disabled={pending || !secret}
              >
                Reset to defaults
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={pending}
              >
                Cancel
              </Button>
            </Actions>
          </WarningBox>
        ) : (
          <Group>
            <GroupText>
              Clear everything and lay the starter categories, accounts and an
              empty budget back down — the state a new account begins in.
            </GroupText>
            <Button
              type="button"
              variant="outline"
              onClick={() => start("reset")}
              disabled={pending}
            >
              Reset to defaults
            </Button>
          </Group>
        )}

        {mode === "clear" ? (
          <WarningBox role="alertdialog" aria-label="Confirm clear data">
            <WarningTitle>⚠ Delete all financial records?</WarningTitle>
            <WarningText>
              Your transactions, imports, accounts, budgets, balances, and plans
              will be permanently removed. Your login, settings, and categories
              stay. This can&rsquo;t be undone.
            </WarningText>
            {renderProof()}
            <Actions>
              <Button
                type="button"
                variant="destructive"
                onClick={onClear}
                disabled={pending || !secret}
              >
                Clear my data
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={pending}
              >
                Cancel
              </Button>
            </Actions>
          </WarningBox>
        ) : (
          <Group>
            <GroupText>
              Delete all your transactions, imports, accounts, budgets,
              balances, and plans. Your login, settings, and categories stay.
            </GroupText>
            <Button
              type="button"
              variant="outline"
              onClick={() => start("clear")}
              disabled={pending}
            >
              Clear my data
            </Button>
          </Group>
        )}

        {mode === "delete" ? (
          <WarningBox role="alertdialog" aria-label="Confirm delete account">
            <WarningTitle>⚠ Permanently delete your account?</WarningTitle>
            <WarningText>
              This removes your account and all associated data, including your
              login. This cannot be undone.
            </WarningText>
            <ConfirmField>
              <ConfirmLabel htmlFor="confirm-delete">
                Type DELETE to confirm
              </ConfirmLabel>
              <ConfirmInput
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm account deletion"
              />
            </ConfirmField>
            {renderProof()}
            <Actions>
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={pending || confirmText !== "DELETE" || !secret}
              >
                Delete my account
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={pending}
              >
                Cancel
              </Button>
            </Actions>
          </WarningBox>
        ) : (
          <Group>
            <GroupText>
              Permanently delete your account and all associated data, including
              your login. This cannot be undone.
            </GroupText>
            <Button
              type="button"
              variant="destructive"
              onClick={() => start("delete")}
              disabled={pending}
            >
              Delete my account
            </Button>
          </Group>
        )}

        {error && <Alert role="alert">{error}</Alert>}
      </SettingsCard>
    </Shell>
  );
}

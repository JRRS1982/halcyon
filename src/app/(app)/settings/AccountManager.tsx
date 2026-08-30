"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { AddAccountDrawer } from "@/app/(app)/balance/AddAccountDrawer";
import { restoreAccount } from "@/app/(app)/balance/accountActions";
import { Button } from "@/components/ui/Button";
import {
  type AccountTypeId,
  accountTypeById,
} from "@/lib/accounts/accountDraft";
import {
  deleteAccount,
  renameAccount,
  setAccountImports,
} from "./accountActions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

export type ManagedAccount = {
  id: string;
  name: string;
  type: AccountTypeId;
  // Transactions that sit IN this account.
  ownedCount: number;
  // Transactions naming this account as a transfer counterparty.
  counterpartyCount: number;
  // Absent on accounts predating this field's read; treated as off.
  canImportTransactions?: boolean;
};

export type ArchivedAccount = { id: string; name: string };

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};
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

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const Grow = styled.span`
  flex: 1;
  min-width: 120px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

const Meta = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;

const Input = styled.input`
  flex: 1;
  min-width: 120px;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const TextButton = styled.button<{ $danger?: boolean }>`
  border: none;
  background: none;
  padding: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.negative : theme.colors.accent};
  cursor: pointer;

  &:disabled {
    color: ${({ theme }) => theme.colors.dim};
    cursor: default;
  }
`;

const ImportToggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  white-space: nowrap;
`;

// The row's action cluster. Inline after the meta on desktop; on a phone it
// takes a full second line, right-aligned, instead of wrapping raggedly with
// one action orphaned per line.
const RowActions = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-left: auto;

  @media (max-width: 767px) {
    flex-basis: 100%;
    justify-content: flex-end;
  }
`;

const CreateRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

type Mode = { kind: "edit" | "delete"; id: string } | null;

export function AccountManager({
  accounts,
  archived,
}: {
  accounts: ManagedAccount[];
  archived: ArchivedAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Settings has no month of its own, so a new account's first observation is
  // recorded against the current month. UTC, not local — the same rule
  // BalanceSheet.tsx/BudgetSheet.tsx use for "today" (and what
  // currentMonthRange() computes server-side): a local-time getter would
  // file a user west of UTC's month-end account under the previous month.
  const now = new Date();
  const thisMonth = { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setMode(null);
      router.refresh();
    });

  const renderRow = (a: ManagedAccount) => {
    const referenced = a.ownedCount + a.counterpartyCount;

    if (mode?.kind === "edit" && mode.id === a.id) {
      return (
        <Row key={a.id}>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <TextButton
            type="button"
            disabled={pending || !editName.trim()}
            onClick={() =>
              run(() => renameAccount({ accountId: a.id, name: editName }))
            }
          >
            Save
          </TextButton>
          <TextButton type="button" onClick={() => setMode(null)}>
            Cancel
          </TextButton>
        </Row>
      );
    }

    if (mode?.kind === "delete" && mode.id === a.id) {
      return (
        <Row key={a.id}>
          <Grow>
            {referenced > 0 ? (
              <>
                <strong>{a.name}</strong> still has {referenced} transaction(s).
                Reassign or remove them before deleting.
              </>
            ) : (
              <>
                Remove <strong>{a.name}</strong>?
              </>
            )}
          </Grow>
          {referenced === 0 && (
            <TextButton
              type="button"
              $danger
              disabled={pending}
              onClick={() => run(() => deleteAccount({ accountId: a.id }))}
            >
              Remove
            </TextButton>
          )}
          <TextButton type="button" onClick={() => setMode(null)}>
            Cancel
          </TextButton>
        </Row>
      );
    }

    return (
      <Row key={a.id}>
        <Grow>{a.name}</Grow>
        <Meta>{accountTypeById(a.type)?.label ?? a.type}</Meta>
        <Meta>{referenced} txns</Meta>
        <RowActions>
          <ImportToggle>
            <input
              type="checkbox"
              checked={a.canImportTransactions ?? false}
              disabled={pending}
              onChange={(e) =>
                run(() =>
                  setAccountImports({
                    accountId: a.id,
                    enabled: e.target.checked,
                  }),
                )
              }
            />
            Allow importing of statements
          </ImportToggle>
          <TextButton
            type="button"
            onClick={() => {
              setMode({ kind: "edit", id: a.id });
              setEditName(a.name);
            }}
          >
            Edit
          </TextButton>
          <TextButton
            type="button"
            $danger
            onClick={() => setMode({ kind: "delete", id: a.id })}
          >
            Delete
          </TextButton>
        </RowActions>
      </Row>
    );
  };

  return (
    <Shell>
      <SettingsCard>
        <SectionHeading>Accounts</SectionHeading>
        <Lead>
          Accounts are where your money sits — current, savings, ISA, SIPP.
          Import statements against them, and name them when tagging a transfer.
          An account can’t be deleted while it still has transactions.
        </Lead>

        {/* The same drawer the balance sheet uses. Adding a name alone made
            an account with no kind and no value, which never appeared on the
            balance sheet and never reached the plan — an account that exists,
            looks right where it was made, and silently goes nowhere. One way
            to create an account, not two that differ invisibly. */}
        <CreateRow>
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={pending}
          >
            Add an account
          </Button>
        </CreateRow>
        <AddAccountDrawer
          open={addOpen}
          year={thisMonth.year}
          month={thisMonth.month}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />

        {accounts.length === 0 ? (
          <Empty>
            No accounts yet — add one above or create one while importing.
          </Empty>
        ) : (
          [...accounts]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(renderRow)
        )}

        {archived.length > 0 && (
          <>
            <SectionHeading>Archived</SectionHeading>
            {[...archived]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((a) => (
                <Row key={a.id}>
                  <Grow>{a.name}</Grow>
                  <TextButton
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => restoreAccount({ accountId: a.id }))
                    }
                  >
                    Restore
                  </TextButton>
                </Row>
              ))}
          </>
        )}
      </SettingsCard>
    </Shell>
  );
}

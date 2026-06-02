"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { SectionHeading } from "./SectionHeading";
import {
  createManagedAccount,
  deleteAccount,
  renameAccount,
} from "./accountActions";

export type ManagedAccount = {
  id: string;
  name: string;
  // Transactions that sit IN this account.
  ownedCount: number;
  // Transactions naming this account as a transfer counterparty.
  counterpartyCount: number;
};

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["5xl"]};
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
}: {
  accounts: ManagedAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setMode(null);
      router.refresh();
    });

  const onCreate = () => {
    if (!newName.trim()) return;
    run(() => createManagedAccount({ name: newName }));
    setNewName("");
  };

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
        <Meta>{referenced} txns</Meta>
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
      </Row>
    );
  };

  return (
    <Shell>
      <SectionHeading>Accounts</SectionHeading>
      <Lead>
        Accounts are where your money sits — current, savings, ISA, SIPP. Import
        statements against them, and name them when tagging a transfer. An
        account can’t be deleted while it still has transactions.
      </Lead>

      <CreateRow>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New account…"
        />
        <Button type="button" onClick={onCreate} disabled={pending}>
          Add
        </Button>
      </CreateRow>

      {accounts.length === 0 ? (
        <Empty>
          No accounts yet — add one above or create one while importing.
        </Empty>
      ) : (
        [...accounts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(renderRow)
      )}
    </Shell>
  );
}

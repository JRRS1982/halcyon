"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { SectionHeading } from "./SectionHeading";
import { clearMyData, deleteMyAccount, exportMyData } from "./dataActions";

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

const DangerZone = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.negative};
  border-radius: ${({ theme }) => theme.rounded.sm};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

const ConfirmInput = styled.input`
  flex: 1;
  min-width: 160px;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Alert = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
`;

export function DataPrivacy() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onExport = () =>
    startTransition(async () => {
      setError(null);
      try {
        const json = await exportMyData();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `halcyon-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("Export failed. Please try again.");
      }
    });

  const onClear = () => {
    if (
      !window.confirm(
        "Delete all your financial records? Your account and settings stay. This cannot be undone.",
      )
    )
      return;
    startTransition(async () => {
      setError(null);
      try {
        await clearMyData();
        router.refresh();
      } catch {
        setError("Couldn't clear your data. Please try again.");
      }
    });
  };

  const onDelete = () =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteMyAccount();
        // On success deleteMyAccount redirects; nothing more to do here.
      } catch {
        setError("Couldn't delete your account. Please try again.");
      }
    });

  return (
    <Shell>
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
          onClick={onExport}
          disabled={pending}
        >
          Export my data
        </Button>
      </Group>

      <Group>
        <GroupText>
          Delete all your transactions, accounts, budgets, and balances. Your
          login, settings, and categories stay.
        </GroupText>
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={pending}
        >
          Clear my data
        </Button>
      </Group>

      <DangerZone>
        <GroupText>
          Permanently delete your account and all associated data. This cannot
          be undone. Type <strong>DELETE</strong> to confirm.
        </GroupText>
        <ConfirmInput
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to confirm"
          aria-label="Type DELETE to confirm account deletion"
        />
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          disabled={pending || confirmText !== "DELETE"}
        >
          Delete my account
        </Button>
      </DangerZone>

      {error && <Alert role="alert">{error}</Alert>}
    </Shell>
  );
}

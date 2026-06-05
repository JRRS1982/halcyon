"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import styled from "styled-components";
import {
  type ImportBatchSummary,
  listImportBatches,
  reverseImport,
} from "./actions";

// "Undo import…" — the outline secondary action paired beside the black
// import CTA. Opens a confirm dialog with a picker of reversible imports;
// confirming soft-deletes that batch's transactions.

const TriggerButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.ink};
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: rgba(15, 17, 22, 0.5);
`;

const Dialog = styled.dialog`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 480px;
  margin: auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: none;
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
`;

const DialogTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const Note = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const BatchSelect = styled.select`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
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

// Destructive per DESIGN.md: outline with red text, never one-click.
const DangerButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.negative};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Toast = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.spacing["2xl"]};
  bottom: ${({ theme }) => theme.spacing["2xl"]};
  z-index: 70;
  padding: ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: rgba(15, 17, 22, 0.08) 0px 4px 12px 0px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

const batchLabel = (b: ImportBatchSummary) => {
  const when = new Date(b.createdAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const file = b.fileName ? ` · ${b.fileName}` : "";
  return `${when} · ${b.count} transactions → ${b.accountName}${file}`;
};

export function ReverseImport() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // null = still loading the list.
  const [batches, setBatches] = useState<ImportBatchSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reversed: number;
    accountName: string;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setBatches(null);
    setSelectedId("");
    setError(null);
  }, []);

  const openDialog = () => {
    setOpen(true);
    setResult(null);
    startTransition(async () => {
      try {
        const list = await listImportBatches();
        setBatches(list);
        setSelectedId(list[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load imports");
        setBatches([]);
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(timer);
  }, [result]);

  const selected = batches?.find((b) => b.id === selectedId) ?? null;

  const onConfirm = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await reverseImport({ batchId: selected.id });
        close();
        setResult(res);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reverse failed");
      }
    });
  };

  return (
    <>
      <TriggerButton type="button" onClick={openDialog}>
        Undo import…
      </TriggerButton>

      {open && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <Dialog open aria-label="Reverse an import">
            <DialogTitle>Reverse an import</DialogTitle>
            {batches === null ? (
              <Note>Loading your imports…</Note>
            ) : batches.length === 0 ? (
              <Note>
                No reversible imports. Only imports made after this feature
                shipped can be reversed, and imports whose transactions are all
                deleted (or already reversed) drop off the list.
              </Note>
            ) : (
              <>
                <Note>
                  This removes every transaction from the selected import — from
                  the ledger, budget actuals and dashboard. Any categories or
                  notes you added to those rows are lost with them, and there is
                  no un-reverse.
                </Note>
                <BatchSelect
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  aria-label="Import to reverse"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {batchLabel(b)}
                    </option>
                  ))}
                </BatchSelect>
              </>
            )}
            {error && <Note>{error}</Note>}
            <DialogActions>
              <GhostButton type="button" onClick={close}>
                {batches?.length === 0 ? "Close" : "Keep them"}
              </GhostButton>
              {selected && (
                <DangerButton
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                >
                  {pending
                    ? "Reversing…"
                    : `Reverse import (delete ${selected.count})`}
                </DangerButton>
              )}
            </DialogActions>
          </Dialog>
        </Overlay>
      )}

      {result && (
        <Toast aria-live="polite">
          Reversed import: removed {result.reversed} transaction(s) from{" "}
          {result.accountName}.
        </Toast>
      )}
    </>
  );
}

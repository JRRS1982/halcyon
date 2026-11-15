"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import styled, { css } from "styled-components";
import { Button } from "@/components/ui/Button";
import { appear } from "@/lib/motion";
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
  border: 1px solid ${({ theme }) => theme.colors.ink};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  font-weight: ${({ theme }) => theme.typography.control.weight};
  white-space: nowrap;
  cursor: pointer;
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
  /* One column that never grows past the dialog: a long file name used to
     widen the track and carry the text out past the dialog's edge. */
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 480px;
  margin: auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: none;
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  ${appear}
`;

const DialogTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.amountXl.family};
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

const Note = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

// A list rather than a select: an option cannot wrap, and a statement's file
// name is often the longest thing in it.
const BatchList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  max-height: 280px;
  overflow-y: auto;
`;

// The list scrolls once it outgrows its box; the count says there is more
// than the rows in view.
const ListCaption = styled.p`
  margin: 0 0 -${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
`;

const BatchOption = styled.label<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: ${theme.spacing.sm};
    align-items: start;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border: 1px solid ${$selected ? theme.colors.primary : theme.colors.fieldBorder};
    box-shadow: ${$selected ? `inset 0 0 0 1px ${theme.colors.primary}` : "none"};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.field};
    font-family: ${theme.typography.bodyMd.family};
    cursor: pointer;

    input {
      margin: 3px 0 0;
      accent-color: ${theme.colors.primary};
    }
  `}
`;

const BatchLines = styled.span`
  display: grid;
  min-width: 0;
`;

const BatchWhen = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};

  strong {
    font-weight: 600;
  }
`;

const BatchFile = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
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

// UK order, as everywhere else in the app: "15 Nov 2026, 20:13".
const importedAt = (b: ImportBatchSummary) =>
  new Date(b.createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const transactionCount = (n: number) =>
  `${n.toLocaleString("en-GB")} transaction${n === 1 ? "" : "s"}`;

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
                <ListCaption>
                  {batches.length === 1
                    ? "1 import"
                    : `${batches.length} imports, newest first`}
                </ListCaption>
                <BatchList role="radiogroup" aria-label="Import to reverse">
                  {batches.map((b) => (
                    <BatchOption key={b.id} $selected={b.id === selectedId}>
                      <input
                        type="radio"
                        name="import-to-reverse"
                        value={b.id}
                        checked={b.id === selectedId}
                        onChange={() => setSelectedId(b.id)}
                      />
                      <BatchLines>
                        <BatchWhen>
                          <strong>{importedAt(b)}</strong> · {b.accountName}
                        </BatchWhen>
                        <BatchFile title={b.fileName ?? undefined}>
                          {transactionCount(b.count)}
                          {b.fileName ? ` · ${b.fileName}` : ""}
                        </BatchFile>
                      </BatchLines>
                    </BatchOption>
                  ))}
                </BatchList>
              </>
            )}
            {error && <Note>{error}</Note>}
            <DialogActions>
              <Button variant="outline" type="button" onClick={close}>
                {batches?.length === 0 ? "Close" : "Keep them"}
              </Button>
              {selected && (
                <Button
                  variant="destructive"
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                >
                  {pending
                    ? "Reversing…"
                    : `Reverse import (delete ${selected.count.toLocaleString("en-GB")})`}
                </Button>
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

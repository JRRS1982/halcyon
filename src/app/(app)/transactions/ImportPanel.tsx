"use client";

import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/transactions/csv";
import { DATE_FORMATS, type DateFormat } from "@/lib/transactions/date";
import {
  type ColumnMapping,
  guessMapping,
  mapRows,
} from "@/lib/transactions/import";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILE_MB,
  MAX_IMPORT_ROWS,
  importLimitHint,
} from "@/lib/transactions/limits";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import styled from "styled-components";
import {
  type ImportPreview,
  type ImportResult,
  commitImport,
  previewImport,
} from "./actions";

type Account = { id: string; name: string };

// The modal body: everything between the title and the action row stacks with
// the same rhythm the old inline panel used.
const ModalBody = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const Label = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;

const FileRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  cursor: pointer;
`;

const HiddenFile = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
`;

// The page's single primary CTA: picking a file opens the import modal.
const FileButton = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  white-space: nowrap;
`;

// States the import limits up front, so a too-big file is a known boundary
// rather than a surprise rejection.
const FileHint = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

const FileName = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const MapGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
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

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;

const CheckRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ theme }) => theme.colors.dim};
  font-weight: 600;
`;

const Td = styled.td<{ $bad?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  color: ${({ $bad, theme }) => ($bad ? theme.colors.dim : theme.colors.ink)};
`;

const Summary = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;

// The destination account gets its own card, set apart from the column
// mapping, so statements don't land in the wrong account by default.
const DestinationCard = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

const DestinationLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};

  > * {
    flex: 0 1 320px;
  }
`;

const Note = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const KeepRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.sm} 0;
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
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 460px;
  margin: auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.canvas};
  border: none;
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
`;

// The import flow is a task, not page furniture — it gets a wide working
// modal (the preview table needs more room than a confirm dialog).
const ImportDialog = styled(Dialog)`
  max-width: 720px;
  max-height: 88vh;
  overflow-y: auto;
`;

// The duplicates confirm stacks above the import modal.
const ConfirmOverlay = styled(Overlay)`
  z-index: 60;
`;

const PreviewScroll = styled.div`
  max-height: 240px;
  overflow: auto;
`;

// Post-import confirmation, anchored bottom-right per DESIGN.md's toast spec.
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

const DialogTitle = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const DupList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  max-height: 280px;
  overflow-y: auto;
`;

const DupRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
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

const NEW_ACCOUNT = "__new__";
const PREVIEW_LIMIT = 8;

function columnLabel(
  rows: string[][],
  hasHeader: boolean,
  index: number,
): string {
  const header = hasHeader ? rows[0]?.[index]?.trim() : "";
  return header ? header : `Column ${index + 1}`;
}

export function ImportPanel({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The import flow runs in a modal: picking a file opens it, finishing (or
  // cancelling) closes it and leaves just the ledger.
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountChoice, setAccountChoice] = useState<string>(
    accounts[0]?.id ?? NEW_ACCOUNT,
  );
  const [newAccountName, setNewAccountName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the preview flags duplicates, we hold them here to confirm; `skip`
  // holds the data-row indexes the user has chosen to skip (default: all
  // flagged).
  const [confirm, setConfirm] = useState<ImportPreview | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());

  const columnCount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.length), 0),
    [rows],
  );

  const preview = useMemo(
    () => (mapping ? mapRows(rows, mapping) : []),
    [rows, mapping],
  );
  const validCount = preview.filter((row) => row.errors.length === 0).length;
  const errorCount = preview.length - validCount;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after a cancel.
    event.target.value = "";
    setResult(null);
    setError(null);
    if (!file) return;

    // Reject oversized files before reading them: the whole CSV is held in
    // memory here and then posted to the server action as JSON, so this is the
    // cap that keeps both bounded.
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRows([]);
      setMapping(null);
      setError(
        `That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the limit is ${MAX_IMPORT_FILE_MB}MB. Export a shorter date range and import it in a few goes.`,
      );
      setOpen(true);
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    const [headerRow] = parsed;
    if (!headerRow) {
      setRows([]);
      setMapping(null);
      setError("That file has no rows.");
      setOpen(true);
      return;
    }
    if (parsed.length > MAX_IMPORT_ROWS) {
      setRows([]);
      setMapping(null);
      setError(
        `That file has ${parsed.length.toLocaleString()} rows — the limit is ${MAX_IMPORT_ROWS.toLocaleString()} per import. Export a shorter date range and import it in a few goes.`,
      );
      setOpen(true);
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    setMapping(guessMapping(headerRow));
    setOpen(true);
  };

  const closeModal = useCallback(() => {
    setOpen(false);
    setConfirm(null);
    setFileName(null);
    setRows([]);
    setMapping(null);
    setError(null);
  }, []);

  // Escape closes the topmost layer: the duplicates confirm first, then the
  // import modal itself.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setConfirm((c) => {
        if (c) return null;
        closeModal();
        return null;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  // The success toast announces the result, then gets out of the way.
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(timer);
  }, [result]);

  const patchMapping = (patch: Partial<ColumnMapping>) =>
    setMapping((current) => (current ? { ...current, ...patch } : current));

  const toggleExtraColumn = (index: number) =>
    setMapping((current) => {
      if (!current) return current;
      const kept = new Set(current.extraColumns ?? []);
      if (kept.has(index)) kept.delete(index);
      else kept.add(index);
      return {
        ...current,
        extraColumns: Array.from(kept).sort((a, b) => a - b),
      };
    });

  const accountArgs = () => ({
    accountId: accountChoice === NEW_ACCOUNT ? null : accountChoice,
    newAccountName: accountChoice === NEW_ACCOUNT ? newAccountName : null,
  });

  const commit = async (skipIndexes: number[]) => {
    if (!mapping) return;
    const res = await commitImport({
      ...accountArgs(),
      rows,
      mapping,
      skipIndexes,
      fileName,
    });
    // The task is done: close the whole modal flow and let the toast +
    // refreshed ledger carry the result.
    closeModal();
    setResult(res);
    router.refresh();
  };

  const onImport = () => {
    if (!mapping) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const pv = await previewImport({ ...accountArgs(), rows, mapping });
        if (pv.duplicates.length === 0) {
          await commit([]);
        } else {
          // Default to skipping every flagged duplicate; the user unticks any
          // that are genuinely separate transactions.
          setSkip(new Set(pv.duplicates.map((d) => d.index)));
          setConfirm(pv);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  const toggleSkip = (index: number) =>
    setSkip((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await commit(Array.from(skip));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  const columnOptions = Array.from(
    { length: columnCount },
    (_, index) => index,
  );
  const accountReady =
    accountChoice !== NEW_ACCOUNT || newAccountName.trim().length > 0;
  // Spelled out wherever the import is described, so a wrong default account
  // gets noticed before committing.
  const destinationName =
    accountChoice === NEW_ACCOUNT
      ? newAccountName.trim() || "a new account"
      : (accounts.find((a) => a.id === accountChoice)?.name ?? "");

  return (
    <>
      <FileRow>
        <HiddenFile type="file" accept=".csv,text/csv" onChange={onFile} />
        <FileButton>Import statement…</FileButton>
        <FileHint>{importLimitHint}</FileHint>
      </FileRow>

      {open && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <ImportDialog open aria-label="Import a statement">
            <DialogTitle>Import a statement</DialogTitle>
            {fileName && <FileName>{fileName}</FileName>}
            {error && <Note>{error}</Note>}

            {mapping && (
              <ModalBody>
                <CheckRow>
                  <input
                    type="checkbox"
                    checked={mapping.hasHeader}
                    onChange={(e) =>
                      patchMapping({ hasHeader: e.target.checked })
                    }
                  />
                  First row is a header
                </CheckRow>

                <MapGrid>
                  <Field>
                    <Label>Date column</Label>
                    <Select
                      value={mapping.dateColumn}
                      onChange={(e) =>
                        patchMapping({ dateColumn: Number(e.target.value) })
                      }
                    >
                      {columnOptions.map((i) => (
                        <option key={i} value={i}>
                          {columnLabel(rows, mapping.hasHeader, i)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field>
                    <Label>Description column</Label>
                    <Select
                      value={mapping.descriptionColumn}
                      onChange={(e) =>
                        patchMapping({
                          descriptionColumn: Number(e.target.value),
                        })
                      }
                    >
                      {columnOptions.map((i) => (
                        <option key={i} value={i}>
                          {columnLabel(rows, mapping.hasHeader, i)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field>
                    <Label>Amount column</Label>
                    <Select
                      value={mapping.amountColumn}
                      onChange={(e) =>
                        patchMapping({ amountColumn: Number(e.target.value) })
                      }
                    >
                      {columnOptions.map((i) => (
                        <option key={i} value={i}>
                          {columnLabel(rows, mapping.hasHeader, i)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field>
                    <Label>Date format</Label>
                    <Select
                      value={mapping.dateFormat}
                      onChange={(e) =>
                        patchMapping({
                          dateFormat: e.target.value as DateFormat,
                        })
                      }
                    >
                      {DATE_FORMATS.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt === "DMY"
                            ? "Day / Month / Year"
                            : fmt === "MDY"
                              ? "Month / Day / Year"
                              : "Year / Month / Day"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </MapGrid>

                {columnOptions.some(
                  (i) =>
                    i !== mapping.dateColumn &&
                    i !== mapping.descriptionColumn &&
                    i !== mapping.amountColumn,
                ) && (
                  <div>
                    <Label>Also keep</Label>
                    <KeepRow>
                      {columnOptions
                        .filter(
                          (i) =>
                            i !== mapping.dateColumn &&
                            i !== mapping.descriptionColumn &&
                            i !== mapping.amountColumn,
                        )
                        .map((i) => (
                          <CheckRow key={i}>
                            <input
                              type="checkbox"
                              checked={
                                mapping.extraColumns?.includes(i) ?? false
                              }
                              onChange={() => toggleExtraColumn(i)}
                            />
                            {columnLabel(rows, mapping.hasHeader, i)}
                          </CheckRow>
                        ))}
                    </KeepRow>
                    <Note>
                      Only the columns you tick here are saved — they appear
                      under each transaction's Details in the ledger (useful for
                      bank reference or type codes). Unticked columns are
                      discarded.
                    </Note>
                  </div>
                )}

                <DestinationCard>
                  <Label>Import into</Label>
                  <DestinationLine>
                    <Select
                      value={accountChoice}
                      onChange={(e) => setAccountChoice(e.target.value)}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                      <option value={NEW_ACCOUNT}>+ New account…</option>
                    </Select>
                    {accountChoice === NEW_ACCOUNT && (
                      <Input
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="e.g. Current account"
                        aria-label="New account name"
                      />
                    )}
                  </DestinationLine>
                </DestinationCard>

                <div>
                  <Label>Preview</Label>
                  <PreviewScroll>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Date</Th>
                          <Th>Description</Th>
                          <Th>Amount</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, PREVIEW_LIMIT).map((row) => {
                          const bad = row.errors.length > 0;
                          return (
                            <tr key={row.index}>
                              <Td $bad={bad}>
                                {row.date
                                  ? row.date.toISOString().slice(0, 10)
                                  : "—"}
                              </Td>
                              <Td $bad={bad}>{row.description || "—"}</Td>
                              <Td $bad={bad}>{row.amount ?? "—"}</Td>
                              <Td $bad={bad}>
                                {bad ? row.errors.join(", ") : "Ready"}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </PreviewScroll>
                  <Summary>
                    {validCount} ready to import into{" "}
                    <strong>{destinationName}</strong>
                    {errorCount > 0
                      ? `, ${errorCount} with errors (skipped)`
                      : ""}
                    .
                  </Summary>
                </div>

                <DialogActions>
                  <GhostButton type="button" onClick={closeModal}>
                    Cancel
                  </GhostButton>
                  <Button
                    type="button"
                    onClick={onImport}
                    disabled={pending || validCount === 0 || !accountReady}
                  >
                    {pending
                      ? "Importing…"
                      : `Import ${validCount} transactions into ${destinationName}`}
                  </Button>
                </DialogActions>
              </ModalBody>
            )}
          </ImportDialog>
        </Overlay>
      )}

      {result && (
        <Toast aria-live="polite">
          Imported {result.imported} into {result.accountName}
          {result.duplicates > 0
            ? `, skipped ${result.duplicates} duplicate(s)`
            : ""}
          {result.invalid > 0 ? `, ${result.invalid} invalid` : ""}.
        </Toast>
      )}

      {confirm && (
        <ConfirmOverlay
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirm(null);
          }}
        >
          <Dialog open>
            <DialogTitle>Possible duplicates</DialogTitle>
            <Note>
              {confirm.duplicates.length} row(s) look like transactions already
              imported into <strong>{destinationName}</strong>. Ticked rows will
              be skipped — untick any that are genuinely separate.
            </Note>
            <DupList>
              {confirm.duplicates.map((d) => (
                <DupRow key={d.index}>
                  <input
                    type="checkbox"
                    checked={skip.has(d.index)}
                    onChange={() => toggleSkip(d.index)}
                  />
                  {d.date.slice(0, 10)} · {d.description} ·{" "}
                  {d.amount.toFixed(2)}
                </DupRow>
              ))}
            </DupList>
            <DialogActions>
              <GhostButton type="button" onClick={() => setConfirm(null)}>
                Cancel
              </GhostButton>
              <Button type="button" onClick={onConfirm} disabled={pending}>
                {pending
                  ? "Importing…"
                  : `Import ${confirm.validCount - skip.size} new${
                      skip.size > 0 ? `, skip ${skip.size}` : ""
                    }`}
              </Button>
            </DialogActions>
          </Dialog>
        </ConfirmOverlay>
      )}
    </>
  );
}

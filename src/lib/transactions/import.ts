// Maps parsed CSV rows onto transaction fields using a user-chosen column
// mapping (which column is the date / amount / description) and date format.
// Pure: orchestrates parseDate + parseAmount and collects per-row errors so the
// import UI can show a preview and let the user fix the mapping before any
// write. A row is importable when its `errors` array is empty.

import { parseAmount } from "./amount";
import { type DateFormat, parseDate } from "./date";

export type ColumnMapping = {
  dateColumn: number;
  amountColumn: number;
  descriptionColumn: number;
  dateFormat: DateFormat;
  hasHeader: boolean;
  // Unmapped columns the user chose to keep. Their values land in
  // Transaction.extra keyed by the column's header label.
  extraColumns?: number[];
};

// Upper bound on how many unmapped columns one import can keep; the
// importTransactions schema enforces the same limit server-side.
export const MAX_EXTRA_COLUMNS = 20;

export type MappedRow = {
  index: number;
  raw: string[];
  date: Date | null;
  amount: number | null;
  description: string;
  extra: Record<string, string> | null;
  errors: string[];
};

const DATE_HINTS = ["date", "posted", "transaction date"];
const AMOUNT_HINTS = ["amount", "value", "debit", "credit", "money"];
const DESCRIPTION_HINTS = [
  "description",
  "details",
  "narrative",
  "payee",
  "reference",
  "memo",
];

function findColumn(
  headers: string[],
  hints: string[],
  fallback: number,
): number {
  const index = headers.findIndex((header) => {
    const normalized = header.trim().toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });
  return index >= 0 ? index : fallback;
}

// Best-effort guess of which columns hold the date / amount / description from
// the header row, so the import UI can pre-fill the mapping. Falls back to the
// first three columns. Every unmapped column starts ticked under "Also keep" —
// discarding data is the choice that should take a deliberate untick. The user
// always confirms/overrides before importing.
export function guessMapping(headers: string[]): ColumnMapping {
  const dateColumn = findColumn(headers, DATE_HINTS, 0);
  const descriptionColumn = findColumn(headers, DESCRIPTION_HINTS, 1);
  const amountColumn = findColumn(headers, AMOUNT_HINTS, 2);
  const core = [dateColumn, descriptionColumn, amountColumn];

  return {
    dateColumn,
    descriptionColumn,
    amountColumn,
    dateFormat: "DMY",
    hasHeader: true,
    extraColumns: headers
      .map((_, i) => i)
      .filter((i) => !core.includes(i))
      .slice(0, MAX_EXTRA_COLUMNS),
  };
}

export function mapRows(rows: string[][], mapping: ColumnMapping): MappedRow[] {
  const dataRows = mapping.hasHeader ? rows.slice(1) : rows;

  // Columns to keep verbatim, excluding the core mapped three, keyed by header
  // label (or position for headerless files).
  const core = [
    mapping.dateColumn,
    mapping.amountColumn,
    mapping.descriptionColumn,
  ];
  const keptColumns = (mapping.extraColumns ?? [])
    .filter((i) => !core.includes(i))
    .map((i) => ({
      index: i,
      key: (mapping.hasHeader ? rows[0]?.[i]?.trim() : "") || `Column ${i + 1}`,
    }));

  return dataRows.map((raw, index) => {
    const errors: string[] = [];

    const date = parseDate(raw[mapping.dateColumn] ?? "", mapping.dateFormat);
    if (!date) errors.push("Invalid date");

    const amount = parseAmount(raw[mapping.amountColumn] ?? "");
    if (amount === null) errors.push("Invalid amount");

    const description = (raw[mapping.descriptionColumn] ?? "").trim();

    let extra: Record<string, string> | null = null;
    for (const col of keptColumns) {
      const value = (raw[col.index] ?? "").trim();
      if (!value) continue;
      extra = extra ?? {};
      extra[col.key] = value;
    }

    return { index, raw, date, amount, description, extra, errors };
  });
}

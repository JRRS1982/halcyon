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
};

export type MappedRow = {
  index: number;
  raw: string[];
  date: Date | null;
  amount: number | null;
  description: string;
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
// first three columns. The user always confirms/overrides before importing.
export function guessMapping(headers: string[]): ColumnMapping {
  return {
    dateColumn: findColumn(headers, DATE_HINTS, 0),
    descriptionColumn: findColumn(headers, DESCRIPTION_HINTS, 1),
    amountColumn: findColumn(headers, AMOUNT_HINTS, 2),
    dateFormat: "DMY",
    hasHeader: true,
  };
}

export function mapRows(rows: string[][], mapping: ColumnMapping): MappedRow[] {
  const dataRows = mapping.hasHeader ? rows.slice(1) : rows;

  return dataRows.map((raw, index) => {
    const errors: string[] = [];

    const date = parseDate(raw[mapping.dateColumn] ?? "", mapping.dateFormat);
    if (!date) errors.push("Invalid date");

    const amount = parseAmount(raw[mapping.amountColumn] ?? "");
    if (amount === null) errors.push("Invalid amount");

    const description = (raw[mapping.descriptionColumn] ?? "").trim();

    return { index, raw, date, amount, description, errors };
  });
}

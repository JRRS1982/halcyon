// Maps parsed CSV rows onto transaction fields using a user-chosen column
// mapping (which column is the date / amount / description) and date format.
// Pure: orchestrates parseDate + parseAmount and collects per-row errors so the
// import UI can show a preview and let the user fix the mapping before any
// write. A row is importable when its `errors` array is empty.

import { parseAmount } from "./amount";
import { type DateFormat, guessDateFormat, parseDate } from "./date";

export type ColumnMapping = {
  dateColumn: number;
  amountColumn: number;
  descriptionColumn: number;
  dateFormat: DateFormat;
  hasHeader: boolean;
  // Unmapped columns the user chose to keep. Their values land in
  // Transaction.extra keyed by the column's header label.
  extraColumns?: number[];
  // Read when the description cell is empty. Monzo leaves Description blank on
  // pot transfers and puts the payee ("Bills Pot") in Name, so without this a
  // whole class of rows imports with no description at all.
  fallbackDescriptionColumn?: number | null;
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
  // True when the description came from the fallback column, so the import
  // card can say how many it filled in.
  isDescriptionFromFallback: boolean;
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
// always confirms/overrides before importing. The date format is read off the
// data rows' date cells, when given.
export function guessMapping(
  headers: string[],
  dataRows: readonly string[][] = [],
): ColumnMapping {
  const dateColumn = findColumn(headers, DATE_HINTS, 0);
  const descriptionColumn = findColumn(headers, DESCRIPTION_HINTS, 1);
  const amountColumn = findColumn(headers, AMOUNT_HINTS, 2);
  const core = [dateColumn, descriptionColumn, amountColumn];
  const nameColumn = headers.findIndex(
    (header) => header.trim().toLowerCase() === "name",
  );

  return {
    dateColumn,
    descriptionColumn,
    amountColumn,
    fallbackDescriptionColumn:
      nameColumn >= 0 && nameColumn !== descriptionColumn ? nameColumn : null,
    dateFormat: guessDateFormat(dataRows.map((row) => row[dateColumn] ?? "")),
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

    const primary = (raw[mapping.descriptionColumn] ?? "").trim();
    const fallback =
      mapping.fallbackDescriptionColumn == null
        ? ""
        : (raw[mapping.fallbackDescriptionColumn] ?? "").trim();
    const isDescriptionFromFallback = !primary && fallback.length > 0;
    const description = primary || fallback;

    let extra: Record<string, string> | null = null;
    for (const col of keptColumns) {
      const value = (raw[col.index] ?? "").trim();
      if (!value) continue;
      extra = extra ?? {};
      extra[col.key] = value;
    }

    return {
      index,
      raw,
      date,
      amount,
      description,
      isDescriptionFromFallback,
      extra,
      errors,
    };
  });
}

// Rows to leave out of an import: every row whose `column` holds one of
// `values`. Monzo's Type column is the case in point — "Pot transfer" rows move
// money between the account and its own pots, which is neither income nor
// spending. Exact match after trimming, so the user sees precisely the values
// they ticked.
export type LeaveOutRule = { column: number; values: string[] };

// Above this many distinct values a column is free text (payees, references),
// not a type code, and a checkbox per value would be a wall.
export const MAX_LEAVE_OUT_VALUES = 25;

const POT_TRANSFER = "pot transfer";

// Pre-fills the rule when the file has a Type column holding pot transfers.
// Anything else starts with nothing left out: dropping rows is the choice that
// should take a deliberate tick.
export function guessLeaveOut(
  headers: string[],
  dataRows: readonly string[][],
): LeaveOutRule | null {
  const column = headers.findIndex(
    (header) => header.trim().toLowerCase() === "type",
  );
  if (column < 0) return null;
  const pot = dataRows
    .map((row) => (row[column] ?? "").trim())
    .find((value) => value.toLowerCase() === POT_TRANSFER);
  return pot ? { column, values: [pot] } : null;
}

// The distinct non-empty values in one column, most common first, or null
// when there are too many to offer as checkboxes.
export function columnValues(
  rows: readonly string[][],
  column: number,
  hasHeader: boolean,
): string[] | null {
  const counts = new Map<string, number>();
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const value = (row[column] ?? "").trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size > MAX_LEAVE_OUT_VALUES) return null;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

export function isLeftOut(row: MappedRow, rule: LeaveOutRule | null): boolean {
  if (!rule || rule.values.length === 0) return false;
  return rule.values.includes((row.raw[rule.column] ?? "").trim());
}

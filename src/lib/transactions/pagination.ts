// Offset pagination for the transactions ledger. The page, search, filters and
// sort all live in the URL
// (?page=2&q=tesco&sort=amount&dir=asc&uncat=1&from=2026-01-01&to=2026-03-31
// &acct=…&cat=…&min=10&max=50) so the server component renders exactly one
// page, and back/forward + shareable links work. Pure helpers only.

import type { SortColumn, SortDir } from "./server";

export const PAGE_SIZE = 50;

const SORT_COLUMNS: SortColumn[] = [
  "date",
  "description",
  "amount",
  "account",
  "category",
];

// What the drawer's category picker resolves to. "transfers" is a sentinel
// rather than an id because a transfer row has no category at all — it keys on
// an account — so it cannot be expressed as one.
export type CategoryFilter =
  | { kind: "any" }
  | { kind: "transfers" }
  | { kind: "category"; categoryId: string };

export type LedgerUrlQuery = {
  page: number;
  search: string;
  onlyUncategorized: boolean;
  sortColumn: SortColumn;
  sortDir: SortDir;
  /** Inclusive YYYY-MM-DD bounds; already validated as real calendar dates. */
  from: string | null;
  to: string | null;
  accountId: string | null;
  category: CategoryFilter;
  /** Non-negative magnitudes — amounts match on absolute value, not sign. */
  amountMin: number | null;
  amountMax: number | null;
};

// Account and category ids are @db.Uuid columns, so anything else is not a
// filter that finds nothing — it is a Prisma error and a 500 on a page anyone
// can reach by editing the address bar. Shape-checked here, at the boundary,
// so a malformed id falls back to "no filter" like every other bad param.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idOrNull = (raw: string | undefined): string | null =>
  raw && UUID.test(raw) ? raw : null;

// A YYYY-MM-DD date, kept as the string the URL and <input type="date"> both
// speak. Round-tripping through Date catches the impossible ones (2026-02-30)
// that the shape alone accepts.
function isoDateOrNull(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
    ? null
    : raw;
}

// A non-negative, finite amount bound. Negative input is rejected rather than
// negated: amounts match on magnitude, so a negative bound has no meaning and
// quietly reinterpreting it would filter by something never asked for.
function amountOrNull(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseCategory(raw: string | undefined): CategoryFilter {
  if (!raw) return { kind: "any" };
  if (raw === "transfers") return { kind: "transfers" };
  const categoryId = idOrNull(raw);
  return categoryId ? { kind: "category", categoryId } : { kind: "any" };
}

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

// Parses the route's searchParams into a sanitized ledger query. Unknown or
// malformed values fall back to the defaults rather than erroring.
export function parseLedgerSearchParams(
  params: Record<string, string | string[] | undefined>,
): LedgerUrlQuery {
  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);
  const sort = first(params.sort);
  const dir = first(params.dir);

  return {
    page: Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1,
    search: (first(params.q) ?? "").slice(0, 200),
    onlyUncategorized: first(params.uncat) === "1",
    sortColumn: SORT_COLUMNS.includes(sort as SortColumn)
      ? (sort as SortColumn)
      : "date",
    sortDir: dir === "asc" || dir === "desc" ? dir : "desc",
    from: isoDateOrNull(first(params.from)),
    to: isoDateOrNull(first(params.to)),
    accountId: idOrNull(first(params.acct)),
    category: parseCategory(first(params.cat)),
    amountMin: amountOrNull(first(params.min)),
    amountMax: amountOrNull(first(params.max)),
  };
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export type PageWindowItem = number | "gap";

// The page numbers to render: first and last always, current ±1, with "gap"
// markers where runs are collapsed. Short ranges render in full.
export function pageWindow(
  current: number,
  totalPages: number,
): PageWindowItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const wanted = new Set<number>([
    1,
    totalPages,
    current - 1,
    current,
    current + 1,
  ]);
  const pages = Array.from(wanted)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const out: PageWindowItem[] = [];
  let prev = 0;
  for (const n of pages) {
    // A gap of exactly one page is rendered as the page itself, not "…".
    if (n - prev === 2) out.push(n - 1);
    else if (n - prev > 2) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

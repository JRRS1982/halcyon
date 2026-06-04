// Offset pagination for the transactions ledger. The page, search, filter and
// sort all live in the URL (?page=2&q=tesco&sort=amount&dir=asc&uncat=1) so
// the server component renders exactly one page, and back/forward + shareable
// links work. Pure helpers only.

import type { SortColumn, SortDir } from "./server";

export const PAGE_SIZE = 50;

const SORT_COLUMNS: SortColumn[] = [
  "date",
  "description",
  "amount",
  "account",
  "category",
];

export type LedgerUrlQuery = {
  page: number;
  search: string;
  onlyUncategorized: boolean;
  sortColumn: SortColumn;
  sortDir: SortDir;
};

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

// Keyset (cursor) pagination for the transactions ledger, ordered by
// (date desc, id desc). The cursor carries the last row's date + id so the
// next query continues strictly after it — fast at any depth and stable when
// new imports arrive. Pure helpers only: the query layer fetches PAGE_SIZE + 1
// rows (the extra "probe" reveals whether another page exists) and hands them
// to sliceForCursor.

export const PAGE_SIZE = 50;

export type Cursor = { id: string; date: Date };

export function encodeCursor({ id, date }: Cursor): string {
  return encodeURIComponent(`${date.toISOString()}|${id}`);
}

export function decodeCursor(raw: string): Cursor | null {
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const pivot = decoded.indexOf("|");
  if (pivot <= 0) return null;

  const id = decoded.slice(pivot + 1);
  if (!id) return null;

  const date = new Date(decoded.slice(0, pivot));
  if (Number.isNaN(date.getTime())) return null;

  return { id, date };
}

export function sliceForCursor<T extends Cursor>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(last) };
}

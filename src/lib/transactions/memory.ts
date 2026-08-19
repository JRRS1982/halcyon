/**
 * Categorisation memory: what category a description was given last time.
 *
 * Bank descriptions repeat month after month with only the reference digits
 * changing ("TESCO STORES 3421" → "TESCO STORES 2211"), so the user's own
 * history is the best classifier available. Nothing is stored — the memory is
 * rebuilt from recent categorised transactions at import time, so it is always
 * exactly what the ledger says and a re-categorisation is learned on the next
 * import automatically.
 */

/**
 * How many recent categorised transactions the memory is built from. Two
 * thousand rows is years of personal-finance history; the cap only exists so
 * the import-time read can't grow without bound.
 */
export const MEMORY_WINDOW = 2000;

/**
 * Collapses a bank description to the part that identifies the merchant:
 * lowercase letters and single spaces, with digits, punctuation and reference
 * codes stripped. Descriptions with no letters at all yield "" and are never
 * matched.
 */
export function descriptionKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type CategorisedRow = {
  description: string;
  categoryId: string;
  date: Date;
};

/**
 * description key → the categoryId it most recently had. Last-used wins, which
 * is the same rule the user applies by hand: however they filed it last month
 * is how they expect it filed this month.
 */
export function buildCategoryMemory(
  history: CategorisedRow[],
): Map<string, string> {
  const latest = new Map<string, CategorisedRow>();
  for (const row of history) {
    const key = descriptionKey(row.description);
    if (!key) continue;
    const current = latest.get(key);
    if (!current || row.date > current.date) latest.set(key, row);
  }

  const memory = new Map<string, string>();
  for (const [key, row] of latest) memory.set(key, row.categoryId);
  return memory;
}

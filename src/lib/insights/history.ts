// A category's actuals over the user's earlier months, in the shape the month
// brief reads. Months come from the user's own recorded periods, so a month
// they never used is not counted as a £0 month "on record".

export type HistoryMonth = { ym: string; label: string };
export type HistoryEntry = { categoryId: string; ym: string; actual: number };
export type CategoryHistory = Record<
  string,
  { label: string; actual: number }[]
>;

/**
 * One series per category across `months` (oldest first), with £0 for a
 * recorded month the category had nothing in.
 */
export function historyByCategory(
  entries: HistoryEntry[],
  months: HistoryMonth[],
): CategoryHistory {
  const totals = new Map<string, number>();
  const categories = new Set<string>();
  for (const entry of entries) {
    categories.add(entry.categoryId);
    const key = `${entry.categoryId}|${entry.ym}`;
    totals.set(key, (totals.get(key) ?? 0) + entry.actual);
  }

  const history: CategoryHistory = {};
  for (const categoryId of categories) {
    history[categoryId] = months.map((month) => ({
      label: month.label,
      actual: totals.get(`${categoryId}|${month.ym}`) ?? 0,
    }));
  }
  return history;
}

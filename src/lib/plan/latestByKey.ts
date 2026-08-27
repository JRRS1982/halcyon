// src/lib/plan/latestByKey.ts
//
// The in-memory half of "the latest row per key". Pure — no Prisma import —
// so the tie-breaking rule it encodes can be unit-tested on its own.

/**
 * The first row per key, from a list already ordered newest-first.
 *
 * The ordering is the caller's job: every caller in reality.ts sorts by
 * `[{ period: { startDate: "desc" } }, { createdAt: "desc" }]`, so the first
 * row a key is seen on is the winner and later ones are older. That secondary
 * sort is load-bearing — two periods can share a startDate (a MONTH and a YEAR
 * period collide on that value) and nothing stops two rows for one key inside
 * a period — but it lives in the query, not here.
 *
 * A null key means "this row belongs to nothing" and is skipped rather than
 * bucketed under a placeholder: the relation columns it keys on are nullable
 * in the schema even when the query's `where` has already excluded nulls.
 *
 * A key absent from the returned map had no row at all. That is deliberately
 * distinguishable from a row holding zero — callers use the difference to
 * decide between skipping a row and reading it as zero.
 */
export function latestByKey<T>(
  orderedNewestFirst: readonly T[],
  keyOf: (row: T) => string | null,
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of orderedNewestFirst) {
    const key = keyOf(row);
    if (key === null) continue;
    if (latest.has(key)) continue;
    latest.set(key, row);
  }
  return latest;
}

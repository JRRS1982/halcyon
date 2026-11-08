/**
 * Which months of the cash-flow chart carry a surplus label. With room, every
 * month; without it (a phone), the latest, the best and the worst, which are
 * the ones worth reading, rather than a row of overlapping chips.
 */
export function labelledMonths(
  nets: readonly number[],
  { roomForAll }: { roomForAll: boolean },
): Set<number> {
  if (roomForAll) return new Set(nets.keys());
  if (nets.length === 0) return new Set();
  const indices = [...nets.keys()];
  const at = (i: number) => nets[i] ?? 0;
  const best = indices.reduce((b, i) => (at(i) > at(b) ? i : b));
  const worst = indices.reduce((w, i) => (at(i) < at(w) ? i : w));
  return new Set([best, worst, nets.length - 1]);
}

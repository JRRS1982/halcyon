// src/lib/plan/verdict.ts
import type { Verdict, YearProjection } from "./types";

export const summarise = (
  years: YearProjection[],
  maxAge?: number,
): Verdict => {
  // Judge feasibility, shortfall and peak over the lived horizon only — a
  // shortfall (or peak) beyond the expected age of death doesn't matter.
  const lived =
    maxAge === undefined ? years : years.filter((y) => y.age <= maxAge);
  const shortfallYear = lived.find((y) => y.shortfall);
  const peak = lived.reduce(
    (best, y) =>
      y.netWorth > best.value ? { age: y.age, value: y.netWorth } : best,
    { age: lived[0]?.age ?? 0, value: Number.NEGATIVE_INFINITY },
  );
  return {
    feasible: shortfallYear === undefined,
    firstShortfallAge: shortfallYear?.age ?? null,
    peakNetWorth: peak,
  };
};

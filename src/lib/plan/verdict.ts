// src/lib/plan/verdict.ts
import type { Verdict, YearProjection } from "./types";

export const summarise = (
  years: YearProjection[],
): Omit<Verdict, "earliestSustainableRetirementAge"> => {
  const shortfallYear = years.find((y) => y.shortfall);
  const peak = years.reduce(
    (best, y) =>
      y.netWorth > best.value ? { age: y.age, value: y.netWorth } : best,
    { age: years[0]?.age ?? 0, value: Number.NEGATIVE_INFINITY },
  );
  return {
    feasible: shortfallYear === undefined,
    firstShortfallAge: shortfallYear?.age ?? null,
    peakNetWorth: peak,
  };
};

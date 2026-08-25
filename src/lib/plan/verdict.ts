// src/lib/plan/verdict.ts
import type { Verdict, YearProjection } from "./types";

export const summarise = (
  years: YearProjection[],
  horizon: { retirementAge?: number; deathAge?: number } = {},
): Verdict => {
  const { retirementAge, deathAge } = horizon;
  // Judge feasibility and the headline figures over the lived horizon only — a
  // shortfall beyond the expected age of death doesn't matter.
  const lived =
    deathAge === undefined ? years : years.filter((y) => y.age <= deathAge);
  const shortfallYear = lived.find((y) => y.shortfall);
  // A milestone the projection never reaches (retiring before the plan starts,
  // dying past its horizon) has no figure to report, so it reads as absent
  // rather than as zero.
  const netWorthAt = (age: number | undefined) => {
    if (age === undefined) return null;
    const match = lived.find((y) => y.age === age);
    return match ? { age: match.age, value: match.netWorth } : null;
  };
  return {
    feasible: shortfallYear === undefined,
    firstShortfallAge: shortfallYear?.age ?? null,
    netWorthAtRetirement: netWorthAt(retirementAge),
    netWorthAtDeath: netWorthAt(deathAge),
  };
};

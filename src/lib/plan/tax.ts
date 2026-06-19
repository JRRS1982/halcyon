// src/lib/plan/tax.ts
import { round } from "./helpers";
import type { Wrapper } from "./types";

// v1 blended-rate tax. Phase 4 swaps in real UK bands.
export const incomeTax = (taxableIncome: number, ratePct: number): number =>
  round((taxableIncome * ratePct) / 100);

export const isTaxableOnWithdrawal = (wrapper: Wrapper): boolean =>
  wrapper === "PENSION" || wrapper === "GIA";

// To net `need` from a taxable pot at `ratePct`, withdraw gross = need / (1 − r);
// the tax is gross − need. Closed-form (no iteration) because the rate is flat.
export const grossUp = (
  need: number,
  ratePct: number,
): { gross: number; tax: number } => {
  const r = ratePct / 100;
  const gross = need / (1 - r);
  return { gross: round(gross), tax: round(gross - need) };
};

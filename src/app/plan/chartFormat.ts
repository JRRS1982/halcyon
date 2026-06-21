// src/app/plan/chartFormat.ts
import { symbolFor } from "@/lib/settings/currency";

// A Y-axis tick formatter for the plan charts: amounts ≥ 1000 collapse to a
// rounded `k` value, smaller amounts render in full. ASCII minus for negatives
// (axis ticks, not body copy). Shared by all three plan charts.
export const makeAmountTick =
  (currency: string) =>
  (v: number): string => {
    const sym = symbolFor(currency);
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    return abs >= 1000
      ? `${sign}${sym}${Math.round(abs / 1000)}k`
      : `${sign}${sym}${abs}`;
  };

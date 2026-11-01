// src/lib/charts/format.ts
import { symbolFor } from "@/lib/settings/currency";

// A Y-axis tick formatter: amounts ≥ 1m collapse to an `m` value (up to 2dp,
// trailing zeros trimmed — "£12.25m" reads far better than "£12250k"), ≥ 1000
// to a `k` value (up to 1dp), smaller amounts in full. ASCII minus for
// negatives (axis ticks, not body copy).
//
// The `k` branch used to round to whole thousands, which is fine while the
// caller pins its gridlines to round steps (see amountAxis) and wrong as soon
// as it doesn't: the dashboard lets Recharts choose ticks, so an axis running
// to £3k produced gridlines at 2250 and 1500 that both rendered "£2k" — two
// different lines wearing the same label. One decimal keeps them apart.
export const makeAmountTick =
  (currency: string) =>
  (v: number): string => {
    const sym = symbolFor(currency);
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000)
      return `${sign}${sym}${Number((abs / 1_000_000).toFixed(2))}m`;
    if (abs >= 1000) return `${sign}${sym}${Number((abs / 1000).toFixed(1))}k`;
    return `${sign}${sym}${Math.round(abs)}`;
  };

export type AmountAxis = { domain: [number, number]; ticks: number[] };

// Builds a numeric Y-axis whose gridlines land on fixed `step` increments,
// spanning the data's [min, max] rounded outward to the nearest step and always
// including 0 so the zero baseline is itself a gridline. Passing both the domain
// and the explicit ticks to Recharts overrides its automatic "nice number" tick
// selection — that's what lets a caller pin the increment (e.g. 250k, 10k).
// Non-finite inputs (empty series) collapse to a single [0, step] interval.
export function amountAxis(min: number, max: number, step: number): AmountAxis {
  const start = Math.floor(Math.min(0, min) / step) * step;
  const endRaw = Math.ceil(Math.max(0, max) / step) * step;
  const end = endRaw === start ? start + step : endRaw;
  const count = Math.round((end - start) / step);
  const ticks = Array.from({ length: count + 1 }, (_, i) => start + i * step);
  return { domain: [start, end], ticks };
}

/** Ages on the multiples of `step` within the data's span: 45, 50, 55… */
export function ageTicks(ages: readonly number[], step = 5): number[] {
  if (ages.length === 0) return [];
  const first = Math.ceil(Math.min(...ages) / step) * step;
  const last = Math.max(...ages);
  const ticks: number[] = [];
  for (let age = first; age <= last; age += step) ticks.push(age);
  return ticks;
}

/**
 * A round gridline step (1, 2 or 5 × a power of ten) that splits the span into
 * about `target` bands, so an axis fitted to someone's own numbers still reads
 * £100k, £200k… rather than £259.4k.
 */
export function niceStep(min: number, max: number, target = 4): number {
  const span = Math.abs(max - min);
  if (span === 0) return 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 5, 10].find((m) => m * power >= raw) ?? 10;
  return nice * power;
}

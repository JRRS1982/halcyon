import { bandsFor, taxYearFor } from "./bands";
import type { Regime } from "./types";

const round = (n: number): number => Math.round(n);

/** Tax due on a total income. The forward direction. */
export function taxOn({
  income,
  year,
  regime,
}: {
  income: number;
  year: string;
  regime: Regime;
}): { tax: number } {
  const taxable = Math.max(0, income - taxYearFor(year).personalAllowance);
  let tax = 0;
  let floor = 0;
  for (const band of bandsFor(year, regime)) {
    const ceiling = band.upTo ?? Number.POSITIVE_INFINITY;
    const width = Math.min(taxable, ceiling) - floor;
    if (width > 0) tax += (width * band.ratePct) / 100;
    floor = ceiling;
    if (taxable <= ceiling) break;
  }
  return { tax: round(tax) };
}

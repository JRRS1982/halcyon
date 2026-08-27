import { bandsFor, taxYearFor } from "./bands";
import type { Regime } from "./types";

const round = (n: number): number => Math.round(n);

/**
 * Tax due on a total income. The forward direction.
 *
 * `thresholdScale` scales the personal allowance and every finite band
 * ceiling by the same factor before walking them — equivalent to inflating
 * the published total-income thresholds, since the allowance and the band
 * boundaries move together. A `null` (unbounded) ceiling is left alone; there
 * is nothing to scale. Pass 1 for the published 2025/26 figures unscaled —
 * required, not defaulted, so a caller can't silently skip inflation.
 */
export function taxOn({
  income,
  year,
  regime,
  thresholdScale,
}: {
  income: number;
  year: string;
  regime: Regime;
  thresholdScale: number;
}): { tax: number } {
  const taxable = Math.max(
    0,
    income - taxYearFor(year).personalAllowance * thresholdScale,
  );
  let tax = 0;
  let floor = 0;
  for (const band of bandsFor(year, regime)) {
    const ceiling =
      band.upTo === null
        ? Number.POSITIVE_INFINITY
        : band.upTo * thresholdScale;
    const width = Math.min(taxable, ceiling) - floor;
    if (width > 0) tax += (width * band.ratePct) / 100;
    floor = ceiling;
    if (taxable <= ceiling) break;
  }
  return { tax: round(tax) };
}

/**
 * Gross withdrawal needed to net `net`, on top of `alreadyTaxed` other income.
 *
 * The same walk as taxOn with the arithmetic inverted: each band's *net
 * capacity* is width × (1 − rate). Walk them, consuming the requirement, and
 * the gross is what was spent getting there.
 *
 * `alreadyTaxed` is why the personal allowance is granted once rather than
 * twice: the withdrawal starts where the year's income left off.
 *
 * Indifferent to how many bands there are — three for rest-of-UK, seven for
 * Scotland, whatever 2035 brings.
 *
 * `taxOn` is the one source of truth for tax: the withdrawal's tax IS the
 * difference it makes to the year's total, taxOn(alreadyTaxed) held fixed.
 * The band walk below rounds an accumulated *gross*; taxOn rounds an
 * accumulated *tax* — two roundings of two different running totals, which
 * can land on different whole pounds right at a band boundary. So the walk
 * only gets gross to within a pound of the answer; taxOn adjudicates from
 * there, nudging gross by the fewest whole pounds so the pair never
 * under-funds the requested net (a pound short compounds over the years a
 * pound over does not).
 *
 * `thresholdScale` scales the personal allowance and every finite band
 * ceiling the same way `taxOn` does, and is passed straight through to the
 * `taxOn` calls below so the band walk and its authoritative adjudication
 * agree on the same scaled thresholds. Required, not defaulted, so a caller
 * can't silently skip inflation — pass 1 for the unscaled figures.
 */
export function grossFor({
  net,
  alreadyTaxed,
  year,
  regime,
  thresholdScale,
}: {
  net: number;
  alreadyTaxed: number;
  year: string;
  regime: Regime;
  thresholdScale: number;
}): { gross: number; tax: number } {
  if (net <= 0) return { gross: 0, tax: 0 };

  const allowance = taxYearFor(year).personalAllowance * thresholdScale;
  const used = Math.max(0, alreadyTaxed - allowance);

  let remaining = net;
  let gross = 0;
  let floor = 0;

  // The untaxed slice of the allowance the income did not consume.
  const allowanceLeft = Math.max(0, allowance - alreadyTaxed);
  if (allowanceLeft > 0) {
    const take = Math.min(remaining, allowanceLeft);
    gross += take;
    remaining -= take;
  }

  for (const band of bandsFor(year, regime)) {
    if (remaining <= 0) break;
    const ceiling =
      band.upTo === null
        ? Number.POSITIVE_INFINITY
        : band.upTo * thresholdScale;
    if (ceiling <= used) {
      floor = ceiling;
      continue;
    }
    const bandFloor = Math.max(floor, used);
    const width = ceiling - bandFloor;
    const netCapacity = width * (1 - band.ratePct / 100);
    const takeNet = Math.min(remaining, netCapacity);
    gross += takeNet / (1 - band.ratePct / 100);
    remaining -= takeNet;
    floor = ceiling;
  }

  const taxOnAlreadyTaxed = taxOn({
    income: alreadyTaxed,
    year,
    regime,
    thresholdScale,
  }).tax;
  const taxAt = (g: number) =>
    taxOn({ income: alreadyTaxed + g, year, regime, thresholdScale }).tax -
    taxOnAlreadyTaxed;

  // The band walk's rounding puts this within a pound of the true answer, so
  // the correction is bounded: nudge up until funded, then back down to the
  // smallest gross that still is.
  let g = round(gross);
  while (g - taxAt(g) < net) g += 1;
  while (g > 0 && g - 1 - taxAt(g - 1) >= net) g -= 1;

  return { gross: g, tax: taxAt(g) };
}

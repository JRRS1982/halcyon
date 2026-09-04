// src/lib/plan/assets.ts
import { grossFor, taxOn } from "@/lib/tax/compute";
import type { Regime } from "@/lib/tax/types";
import { isTaxableOnWithdrawal } from "./tax";
import type { AssetInput } from "./types";

/**
 * Whether this asset is an entitlement — a promise of income — rather than a
 * pot. See AssetInput.annualIncome.
 *
 * A *positive* figure, not merely a set one. The field is nullable, the card's
 * placeholder for it reads "0", and blank and 0 are indistinguishable in that
 * input while meaning opposite things: someone entering an NHS pension's
 * £120,000 transfer value who types 0 into "Pension income /yr" is saying "I
 * don't know yet", not "this pot is an income of nothing". Read as an
 * entitlement, that answer deleted the £120,000 from the projection's net
 * worth, made the row undrawable, and paid an income of zero. An entitlement
 * recorded as zero is not an entitlement.
 */
export const isEntitled = (
  a: AssetInput,
): a is AssetInput & { annualIncome: number } => (a.annualIncome ?? 0) > 0;

// An entitled asset is an income stream, not a fund — it is never a
// contribution target and never drawn from.
export const drawable = (a: AssetInput): boolean =>
  a.wrapper !== "PROPERTY" && !isEntitled(a);

// Earliest age an asset may be drawn. PENSION defaults to 57 when unset; other
// wrappers are unrestricted unless an explicit minAccessAge is given.
const accessLimit = (a: AssetInput): number | null =>
  a.minAccessAge ?? (a.wrapper === "PENSION" ? 57 : null);

// Where leftover surplus sits: the CASH buffer. Falls back to the most-liquid
// non-PROPERTY asset (lowest drawdownPriority); null when there are no assets,
// or when none are drawable — a PROPERTY must never be a contribution target,
// since a later sale zeroes it and would silently erase the surplus deposited
// there, and neither must an entitlement, whose balance is zeroed every single
// year. The CASH shortcut is held to the same `drawable` test as the fallback
// rather than trusting the wrapper alone: a CASH account carrying an
// annualIncome is reachable (a FINAL_SALARY corrected to SAVINGS keeps it),
// and money paid into it would disappear with no shortfall reported.
export const contributionTargetId = (assets: AssetInput[]): string | null => {
  if (assets.length === 0) return null;
  const cash = assets.find((a) => a.wrapper === "CASH" && drawable(a));
  if (cash) return cash.id;
  const liquid = assets.filter(drawable);
  if (liquid.length === 0) return null;
  return liquid.reduce((best, a) =>
    a.drawdownPriority < best.drawdownPriority ? a : best,
  ).id;
};

export interface FundResult {
  balances: Record<string, number>;
  withdrawnByAsset: Record<string, number>; // gross withdrawn per asset
  withdrawalTax: number;
  totalWithdrawn: number; // gross
  shortfall: boolean;
}

export interface WithdrawalTaxContext {
  // The year's income already taxed before a penny is withdrawn. Every taxable
  // withdrawal stacks on top of it, which is why the personal allowance is
  // granted once per year rather than once per calculation.
  alreadyTaxed: number;
  year: string;
  regime: Regime;
  thresholdScale: number;
}

// Funds a net `need` from non-PROPERTY assets in ascending drawdownPriority.
// Taxable pots (PENSION/GIA) are grossed up through the bands so the net
// delivered covers the spending need; the gross-up is booked as withdrawalTax.
// Each taxable pot drawn raises the running total the next one stacks on, so
// two pots in one year are taxed as one withdrawal split in two, not as two
// independent withdrawals. Input balances are not mutated.
export const fundDeficit = (
  assets: AssetInput[],
  balances: Record<string, number>,
  need: number,
  tax: WithdrawalTaxContext,
  age: number,
): FundResult => {
  const next = { ...balances };
  const withdrawnByAsset: Record<string, number> = {};
  let remaining = need;
  let withdrawalTax = 0;
  let taxedSoFar = tax.alreadyTaxed;

  const { year, regime, thresholdScale } = tax;
  // What a gross withdrawal of `gross` adds to the year's tax bill, stacked on
  // everything taxed before it.
  const taxDelta = (gross: number): number =>
    taxOn({ income: taxedSoFar + gross, year, regime, thresholdScale }).tax -
    taxOn({ income: taxedSoFar, year, regime, thresholdScale }).tax;

  const order = assets
    .filter(drawable)
    .filter((a) => {
      const limit = accessLimit(a);
      return limit === null || age >= limit;
    })
    .sort((a, b) => a.drawdownPriority - b.drawdownPriority);

  for (const a of order) {
    if (remaining <= 0) break;
    const balance = next[a.id] ?? 0;
    if (balance <= 0) continue;

    if (isTaxableOnWithdrawal(a.wrapper)) {
      // Draining the pot is settled directly rather than through grossFor: the
      // inverse walk answers "what gross nets X", and the answer here is capped
      // by the balance, not by the requirement.
      const taxIfDrained = taxDelta(balance);
      const grossed =
        balance - taxIfDrained <= remaining
          ? undefined
          : grossFor({
              net: remaining,
              alreadyTaxed: taxedSoFar,
              year,
              regime,
              thresholdScale,
            });
      // grossFor's never-under-fund nudge can round its answer up to (or
      // past) the whole balance when the need sits within a pound of what a
      // full drain nets. Treat that as a drain too, so the pot closes at
      // exactly zero instead of a fraction of a pound negative.
      const { gross, tax: due } =
        grossed === undefined || grossed.gross >= balance
          ? { gross: balance, tax: taxIfDrained }
          : grossed;
      next[a.id] = balance - gross;
      withdrawnByAsset[a.id] = gross;
      withdrawalTax += due;
      taxedSoFar += gross;
      remaining -= gross - due;
    } else {
      const take = Math.min(balance, remaining);
      next[a.id] = balance - take;
      withdrawnByAsset[a.id] = take;
      remaining -= take;
    }
  }

  const totalWithdrawn = Object.values(withdrawnByAsset).reduce(
    (s, v) => s + v,
    0,
  );
  return {
    balances: next,
    withdrawnByAsset,
    withdrawalTax,
    totalWithdrawn,
    shortfall: remaining > 0,
  };
};

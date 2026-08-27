// src/lib/plan/assets.ts
import { grossFor, taxOn } from "@/lib/tax/compute";
import type { Regime } from "@/lib/tax/types";
import { isTaxableOnWithdrawal } from "./tax";
import type { AssetInput } from "./types";

export const drawable = (a: AssetInput): boolean => a.wrapper !== "PROPERTY";

// Earliest age an asset may be drawn. PENSION defaults to 57 when unset; other
// wrappers are unrestricted unless an explicit minAccessAge is given.
const accessLimit = (a: AssetInput): number | null =>
  a.minAccessAge ?? (a.wrapper === "PENSION" ? 57 : null);

// Where leftover surplus sits: the CASH buffer. Falls back to the most-liquid
// non-PROPERTY asset (lowest drawdownPriority); null when there are no assets,
// or when none are drawable (all PROPERTY) — a PROPERTY must never be a
// contribution target, since a later sale zeroes it and would silently erase
// the surplus deposited there.
export const contributionTargetId = (assets: AssetInput[]): string | null => {
  if (assets.length === 0) return null;
  const cash = assets.find((a) => a.wrapper === "CASH");
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

  const { year, regime } = tax;
  // What a gross withdrawal of `gross` adds to the year's tax bill, stacked on
  // everything taxed before it.
  const taxDelta = (gross: number): number =>
    taxOn({ income: taxedSoFar + gross, year, regime }).tax -
    taxOn({ income: taxedSoFar, year, regime }).tax;

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
      const { gross, tax: due } =
        balance - taxIfDrained <= remaining
          ? { gross: balance, tax: taxIfDrained }
          : grossFor({
              net: remaining,
              alreadyTaxed: taxedSoFar,
              year,
              regime,
            });
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

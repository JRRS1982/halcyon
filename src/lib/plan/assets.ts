import { grossUp, isTaxableOnWithdrawal } from "./tax";
// src/lib/plan/assets.ts
import type { AssetInput } from "./types";

const drawable = (a: AssetInput): boolean => a.wrapper !== "PROPERTY";

// Where leftover surplus sits: the CASH buffer. Falls back to the most-liquid
// non-PROPERTY asset (lowest drawdownPriority), then the first asset; null only
// when there are no assets.
export const contributionTargetId = (assets: AssetInput[]): string | null => {
  if (assets.length === 0) return null;
  const cash = assets.find((a) => a.wrapper === "CASH");
  if (cash) return cash.id;
  const liquid = assets.filter(drawable);
  const pool = liquid.length > 0 ? liquid : assets;
  return pool.reduce((best, a) =>
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

// Funds a net `need` from non-PROPERTY assets in ascending drawdownPriority.
// Taxable pots (PENSION/GIA) are grossed up at `ratePct` so the net delivered
// covers the spending need; the gross-up is booked as withdrawalTax. Input
// balances are not mutated.
export const fundDeficit = (
  assets: AssetInput[],
  balances: Record<string, number>,
  need: number,
  ratePct: number,
): FundResult => {
  const next = { ...balances };
  const withdrawnByAsset: Record<string, number> = {};
  let remaining = need;
  let withdrawalTax = 0;

  const order = assets
    .filter(drawable)
    .sort((a, b) => a.drawdownPriority - b.drawdownPriority);

  for (const a of order) {
    if (remaining <= 0) break;
    const balance = next[a.id] ?? 0;
    if (balance <= 0) continue;

    if (isTaxableOnWithdrawal(a.wrapper)) {
      const r = ratePct / 100;
      const netAvailable = balance * (1 - r);
      const net = Math.min(netAvailable, remaining);
      const { gross, tax } = grossUp(net, ratePct);
      next[a.id] = balance - gross;
      withdrawnByAsset[a.id] = gross;
      withdrawalTax += tax;
      remaining -= net;
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

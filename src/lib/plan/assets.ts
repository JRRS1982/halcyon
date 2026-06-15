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

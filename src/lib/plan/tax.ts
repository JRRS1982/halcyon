// src/lib/plan/tax.ts
import type { Wrapper } from "./types";

// Which wrappers are taxed when money comes *out*. Nothing to do with bands —
// the band arithmetic lives in src/lib/tax/.
export const isTaxableOnWithdrawal = (wrapper: Wrapper): boolean =>
  wrapper === "PENSION" || wrapper === "GIA";

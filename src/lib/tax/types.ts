export type Regime = "RUK" | "SCOTLAND";

/** Upper bound on *taxable* income (after the personal allowance). null = unbounded. */
export type Band = { upTo: number | null; ratePct: number };

export type TaxYear = {
  year: string;
  personalAllowance: number;
  bands: Record<Regime, Band[]>;
};

export type TaxContext = { year: string; regime: Regime };

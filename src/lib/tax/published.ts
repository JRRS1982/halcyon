import { bandsFor, taxYearFor } from "./bands";
import type { Regime } from "./types";

// What HMRC publishes, derived from what we store.
//
// The stored table is on *taxable* income, with the personal-allowance taper
// modelled as a 60% band (67.5% in Scotland) — arithmetically identical to the
// published rules, and the reason the engine has no circularity to solve. It
// is not, however, what anyone recognises: there is no 60% band in any HMRC
// table, and showing one would read as a bug rather than as a reformulation.
//
// So the display goes back the other way: add the allowance to reach
// total-income thresholds, and drop the taper rows, describing the taper in
// words instead. Deriving this from the same table the engine walks means the
// card cannot drift from the arithmetic — and its test is a standing check
// that the stored figures really are the published ones.
export type PublishedBand = {
  name: string;
  ratePct: number;
  /** Total income where this band starts, inclusive. */
  from: number;
  /** Total income where it ends, or null for the top band. */
  to: number | null;
};

export type PublishedRates = {
  year: string;
  personalAllowance: number;
  bands: PublishedBand[];
  /** Where the allowance starts being withdrawn, and how fast. */
  taper: { from: number; perPounds: number } | null;
};

// The taper is the only place two adjacent rows share a published rate: the
// stretch above £100,000 is the band below it plus the allowance being
// withdrawn. Naming the bands is presentation, so the names live here rather
// than beside the figures the engine walks.
const RUK_NAMES = ["Basic rate", "Higher rate", "Additional rate"];
const SCOTLAND_NAMES = [
  "Starter rate",
  "Basic rate",
  "Intermediate rate",
  "Higher rate",
  "Advanced rate",
  "Top rate",
];

export function publishedRates(year: string, regime: Regime): PublishedRates {
  const table = taxYearFor(year);
  const allowance = table.personalAllowance;
  const taperFrom = 100_000;

  // Drop the taper row: its rate is the band below it plus 20 points of
  // withdrawn allowance, so it is not a published band at all.
  const isTaper = (ratePct: number, previous: number | undefined) =>
    previous !== undefined && ratePct === previous * 1.5;

  const raw = bandsFor(year, regime);
  const names = regime === "SCOTLAND" ? SCOTLAND_NAMES : RUK_NAMES;

  const bands: PublishedBand[] = [];
  let floor = 0;
  let previousRate: number | undefined;

  for (const band of raw) {
    const ceiling = band.upTo;
    if (isTaper(band.ratePct, previousRate)) {
      floor = ceiling ?? floor;
      continue;
    }
    bands.push({
      name: names[bands.length] ?? `${band.ratePct}% rate`,
      ratePct: band.ratePct,
      from: floor + allowance + 1,
      to: ceiling === null ? null : ceiling + allowance,
    });
    floor = ceiling ?? floor;
    previousRate = band.ratePct;
  }

  // The band the taper sits inside keeps its published ceiling: the rows were
  // merged, so the one before the taper must run on to the one after it.
  for (let i = 0; i < bands.length - 1; i++) {
    const next = bands[i + 1];
    const current = bands[i];
    if (current && next) current.to = next.from - 1;
  }

  return {
    year: table.year,
    personalAllowance: allowance,
    bands,
    taper: { from: taperFrom, perPounds: 2 },
  };
}

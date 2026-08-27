import type { Regime, TaxContext, TaxYear } from "./types";

// Bands are on TAXABLE income — total income minus a constant personal
// allowance. The personal-allowance taper (£1 lost per £2 above £100,000) is
// modelled as a 60% band rather than a shrinking allowance. That is not an
// approximation: it is arithmetically identical, because the taper is linear —
// each extra £1 over £100,000 costs 50p of allowance that was being taxed at
// 40%, so the marginal rate is 40% + 20% = 60%. Verified against the tapered
// calculation at 30k, 60k, 100k, 110k, 125,140, 130k and 200k — equal at every
// point, including both boundaries.
//
// Modelling it this way removes a circularity: the allowance would otherwise
// depend on total income, which depends on the withdrawal, which depends on the
// allowance.
//
// In taxable terms with a full £12,570 allowance:
//   basic ends at  50,270 − 12,570 =  37,700
//   taper starts at 100,000 − 12,570 =  87,430
//   taper ends at  125,140 − 12,570 = 112,570
//
// Scottish bands and thresholds verified against gov.scot / mygov.scot for
// 2025/26: starter 19%, basic 20%, intermediate 21%, higher 42%, advanced 45%,
// top 48%, with total-income thresholds 12,571 / 15,397 / 27,491 / 43,662 /
// 75,000 / 100,000 / 125,140 — 2,827 / 14,921 / 31,092 / 62,430 / 87,430 /
// 112,570 in taxable terms. The advanced-rate taper band is
// 45 + (45 × 0.5) = 67.5, by the same reasoning as rest-of-UK's 60.
const YEARS: TaxYear[] = [
  {
    year: "2025/26",
    endsInCalendarYear: 2026,
    personalAllowance: 12_570,
    bands: {
      RUK: [
        { upTo: 37_700, ratePct: 20 },
        { upTo: 87_430, ratePct: 40 },
        { upTo: 112_570, ratePct: 60 }, // the taper
        { upTo: null, ratePct: 45 },
      ],
      SCOTLAND: [
        { upTo: 2_827, ratePct: 19 }, // starter,      to 15,397 total
        { upTo: 14_921, ratePct: 20 }, // basic,        to 27,491
        { upTo: 31_092, ratePct: 21 }, // intermediate, to 43,662
        { upTo: 62_430, ratePct: 42 }, // higher,       to 75,000
        { upTo: 87_430, ratePct: 45 }, // advanced,     to 100,000
        { upTo: 112_570, ratePct: 67.5 }, // advanced + taper
        { upTo: null, ratePct: 48 }, // top
      ],
    },
  },
];

export const LATEST_YEAR = YEARS[YEARS.length - 1] as TaxYear;

export function taxYearFor(year: string): TaxYear {
  return YEARS.find((y) => y.year === year) ?? LATEST_YEAR;
}

export function bandsFor(year: string, regime: Regime) {
  return taxYearFor(year).bands[regime];
}

/**
 * The tax context for a projection year. Derived, never stored.
 *
 * The table holds one entry today, so every projection year is walked against
 * it — but its thresholds may need scaling first. A tax year is a straddling
 * period (2025/26 runs 6 Apr 2025 → 5 Apr 2026); a projection year is a plain
 * calendar year. The anchor for "how many years of inflation have passed" is
 * the calendar year the latest known tax year *ends* in (2026, for 2025/26),
 * not the year it's named after: that's the year most of calendar 2026 falls
 * in, so calendar 2026 is still served by the 2025/26 table unscaled, and
 * calendar 2027 is the first year that needs one year of inflation applied.
 * Everything on or before the anchor year gets scale 1, whether or not the
 * toggle is on — there's nothing to inflate yet.
 */
export function taxContextFor({
  projectionYear,
  regime,
  inflationPct,
  inflationLinked,
}: {
  projectionYear: number;
  regime: Regime;
  inflationPct: number;
  inflationLinked: boolean;
}): TaxContext {
  const exponent = Math.max(0, projectionYear - LATEST_YEAR.endsInCalendarYear);
  const thresholdScale = inflationLinked
    ? (1 + inflationPct / 100) ** exponent
    : 1;
  return { year: LATEST_YEAR.year, regime, thresholdScale };
}

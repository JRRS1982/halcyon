# Income tax: bands the user never types

Before this feature, the projection taxed a single blended rate the user
typed into the Assumptions panel — a v1 simplification recorded in the
original life-planning design as a deliberate trade against annual
maintenance. It also hid a real defect: a year's income and a pension
withdrawal were taxed as two independent calculations, so the personal
allowance was applied twice. Under-taxing by a whole allowance every year
errs in the dangerous direction — it makes a plan look feasible when it
isn't.

The projection now applies real UK income tax from shipped band data. See
[the design doc](../superpowers/specs/2026-08-27-uk-income-tax-design.md) for
the reasoning that got here — this doc covers what was actually built and the
things a reader would otherwise have to reverse-engineer.

## Bands are shipped data, not a setting

UK tax bands are a public fact, identical for every user, and silently wrong
if mistyped. They ship in [`src/lib/tax/bands.ts`](../../src/lib/tax/bands.ts),
keyed by tax year and regime — only two things are stored about the *user*,
because only two are about them: `Plan.taxRegime` (`RUK` | `SCOTLAND`) and
`Plan.thresholdsInflationLinked`. Wales sets no separate income tax rates
today, so it isn't a regime; Northern Ireland follows rest-of-UK.

`src/lib/tax/` sits outside `src/lib/plan/` on purpose: tax is a fact about
the UK, not a feature of the projection. It imports no database and no plan
module.

- `types.ts` — `Regime`, `Band` (`{ upTo: number | null; ratePct: number }`,
  `null` = unbounded), `TaxYear`, `TaxContext`.
- `bands.ts` — the `YEARS` table (one entry, `2025/26`) and the year/context
  lookups.
- `compute.ts` — `taxOn` and `grossFor`, the walk in both directions.

Bands sit on **taxable income after the personal allowance**, not on total
income — the taper (below) shrinks the allowance rather than moving
thresholds, so computing the allowance first and walking the bands second
keeps the two concerns apart. Rest-of-UK has four bands (including the
taper); Scotland has seven. The same walk in `taxOn`/`grossFor` handles both
without knowing which it's holding.

## The taper is a band, not a special case

Above £100,000 the personal allowance falls by £1 for every £2 of income —
an effective 60% marginal rate between £100,000 and £125,140 (67.5% in
Scotland, on top of the 45% advanced rate). Modelling that as a shrinking
allowance creates a circularity: the allowance depends on total income,
total income depends on the withdrawal, and the withdrawal depends on the
allowance.

It dissolves because the taper is linear: each extra £1 over £100,000 costs
50p of allowance that was being taxed at 40%, so the marginal rate is
40% + 20% = 60%. Keeping the allowance constant and inserting a 60% band
over that stretch is arithmetically identical to the tapered calculation —
verified in `bands.ts`'s comments and in `compute.test.ts` at £30k, £60k,
£100k, £110k, £125,140, £130k and £200k, equal at every point including both
boundaries. In taxable terms (income minus the full £12,570 allowance): the
taper starts at 100,000 − 12,570 = 87,430 and ends at 125,140 − 12,570 =
112,570 — the boundaries the `RUK` band table actually uses.

Scotland's advanced-rate taper band is `45 + (45 × 0.5) = 67.5`, by the same
reasoning.

So the taper is a row in the band table. No circularity, no iteration, no
special case in the walk.

## Two functions, one walk, both directions

`taxOn({ income, year, regime, thresholdScale? })` is the forward direction:
subtract the (possibly scaled) personal allowance, walk the bands, accumulate
tax on each width.

`grossFor({ net, alreadyTaxed, year, regime, thresholdScale? })` is the
inverse the projection actually needs — "the plan requires £X in hand; how
much must it withdraw?" It walks the same bands with the arithmetic inverted:
each band's *net capacity* is `width × (1 − rate)`, consumed until the
requirement is met, with `alreadyTaxed` shifting where the walk starts.

**`alreadyTaxed` is why the personal allowance is granted once per year, not
once per calculation.** A withdrawal's walk starts where the year's other
income left off, so it's taxed as a continuation of one income rather than as
a second income starting fresh at £0. This is what closes the
double-allowance defect the feature exists to fix — see "One tax context per
projection year," below.

`grossFor`'s band walk is not exact: it rounds an accumulated *gross*, while
`taxOn` (called to get the walk's actual tax) rounds an accumulated *tax* —
two roundings of two different running totals that can land on different
whole pounds right at a band boundary. So the walk only gets gross to within
a pound of the true answer; `taxOn` is the one source of truth for tax and
adjudicates from there (`compute.ts`'s `grossFor`, the nudge loop at the
bottom). It nudges gross by the fewest whole pounds so the pair never
under-funds the requested net — **a pound short compounds across a
projection; a pound over does not.** This is a deliberate bias, not a defect:
the unclaimed net is at most £1 per taxable pot per year, roughly £40 nominal
across a 40-year plan.

Both functions are indifferent to how many bands there are — three... well,
four including the taper for rest-of-UK, seven for Scotland, whatever a
future year brings.

## One tax context per projection year

A year's income and any pension/GIA withdrawal are two halves of one
calculation, not two independent ones. `project.ts` builds a single
`taxContextFor(...)` per projection year and threads it through both:

```ts
const taxCtx = taxContextFor({
  projectionYear: input.startYear + yearsElapsed,
  regime: input.taxRegime,
  inflationPct: input.inflationPct,
  inflationLinked: input.thresholdsInflationLinked,
});
const incTax = taxOn({ income: income.taxableTotal, ...taxCtx }).tax;
// … expenses, liabilities, contributions unchanged …
const fund = fundDeficit(
  runAssets, assetBal, -cashflow,
  { alreadyTaxed: income.taxableTotal, ...taxCtx },
  age,
);
```

`fundDeficit` (`src/lib/plan/assets.ts`) passes that `alreadyTaxed` through
to `grossFor`/`taxOn` for every taxable pot it drains, and **accumulates
`taxedSoFar` as it goes** — so if two taxable pots are drawn in the same
year, the second is taxed as a continuation of the first, not as its own
withdrawal starting at £0. Two pensions drawn in one year get one allowance
between them, not two.

This is the fix in full: it has two levels. `alreadyTaxed` grants the
allowance once between a year's income and its first withdrawal; `taxedSoFar`
inside `fundDeficit` grants it once again across multiple withdrawals in the
same year. Losing either one reintroduces the double-allowance defect for a
different pair of numbers.

## Which wrappers are taxed on withdrawal

`isTaxableOnWithdrawal` (`src/lib/plan/tax.ts`) is unrelated to the band
arithmetic — it just says which wrappers are taxed as income when money comes
*out*: `PENSION` and `GIA`. Everything else (`ISA`, `CASH`, …) is drawn
untaxed. `fundDeficit` drains assets in ascending `drawdownPriority`; for a
taxable pot it either drains the whole balance (settled directly via
`taxDelta`, since the requirement being smaller than the balance means the
inverse walk isn't needed) or grosses up through `grossFor` when the balance
alone can't cover the remaining need.

## GIA: the most misleading number this feature can produce

`isTaxableOnWithdrawal` treats a GIA withdrawal as taxable **income**. Under
the old flat blended rate that read as a rough stand-in for the real tax on a
GIA (capital gains, not income tax). Under real bands it no longer does: a
£60k/year spend funded from a £1m GIA now books tens of thousands of pounds
of *income* tax against £0 from an equivalent ISA, and a GIA-heavy plan can
be pushed straight into the 60% taper band — a marginal rate that has nothing
to do with the real liability, which is capital gains tax, often nil after
allowances and the CGT annual exempt amount.

Capital gains tax is out of scope (below), so this approximation was never
correct, but bands changed its character: it went from "roughly the right
order of magnitude" to "a number that can be actively misleading," because
it now interacts with the same progressive bands as salary and pension
income. **Nobody should read a GIA drawdown's tax figure in this projection
as a modelled CGT estimate.** Treat GIA tax output as a placeholder, not an
answer, until CGT modelling exists.

## Which tax year applies, and the maintenance hazard

`taxYearFor(year)` looks a year up in the `YEARS` table and **falls back to
the most recent entry if it isn't found**:

```ts
export function taxYearFor(year: string): TaxYear {
  return YEARS.find((y) => y.year === year) ?? LATEST_YEAR;
}
```

Today `taxContextFor` always asks for `LATEST_YEAR.year`, so the fallback
never fires in practice — but it is not what makes future years safe. The
table holds exactly one entry (`2025/26`). When the next UK tax year lands
and nobody adds it, **nothing fails.** The app keeps computing tax against
2025/26's bands and personal allowance forever, silently. There is no error,
no warning, no test that goes red on its own — a stale table looks
indistinguishable from a correct one until someone checks the numbers by
hand against gov.uk.

In tax code, a silent wrong-year fallback is not a convenience — it's a wrong
number with no signal. **This is recorded as a deferred item.** Whoever adds
the second tax year to `YEARS` must also make the fallback loud: fail, warn,
or otherwise surface that `taxYearFor` couldn't find the year it was asked
for, rather than quietly substituting the newest one. Adding a year's data is
in scope for a routine update; changing what a *missing* year does is not
optional cleanup, it's the other half of the same job.

## The inflation anchor

`Plan.thresholdsInflationLinked` (default `true`) controls whether the
personal allowance and every finite band ceiling scale up in later
projection years, or stay frozen at the 2025/26 figures forever.

The anchor for "how many years of inflation have passed" is the calendar
year the **latest known tax year ends in** — `endsInCalendarYear: 2026` for
`2025/26`, not the year the tax year is named after (2025). A projection
year in `project.ts` is a plain calendar year, while a UK tax year straddles
two (2025/26 runs 6 April 2025 → 5 April 2026). Since most of calendar 2026
falls inside 2025/26, calendar 2026 is still served by the 2025/26 table
unscaled — `thresholdScale` is 1 — and calendar 2027 is the first year that
gets one full year of inflation applied. Everything on or before the anchor
year gets scale 1 regardless of the toggle, because there's nothing to
inflate yet:

```ts
const exponent = Math.max(0, projectionYear - LATEST_YEAR.endsInCalendarYear);
const thresholdScale = inflationLinked ? (1 + inflationPct / 100) ** exponent : 1;
```

Whoever adds `2026/27` to the table needs this rule too: the anchor moves to
whatever calendar year the new latest entry ends in, and the exponent counts
from there.

**Why the toggle defaults to inflation-linked**, when frozen thresholds are
the superficially conservative (more-tax) choice: frozen is not conservative
over a fifty-year projection, it's implausible. At 2.5% inflation, prices
roughly 2.7× over forty years, so a £50,000 salary becomes ~£134,000 nominal
against a higher-rate threshold still stuck at £50,270 — nearly two thirds of
income taxed at 40%, swamping every other assumption in the model. Measured
on this engine: a SIPP-funded retirement with £40k of inflation-linked spend
sees its effective withdrawal tax rate rise from 14.6% at age 60, to 23.4% at
75, to 35.6% at 95 — purely from fiscal drag against frozen thresholds. The
plan already has a real pessimism lever, `returnSpreadPct`; tax doesn't need
to carry that job too. A user who wants the pessimistic read can still switch
the toggle off.

## Out of scope

Named so nobody builds these by accident:

- **National Insurance, dividend and capital-gains rates.** Income tax only
  — see the GIA caveat above for where that specifically bites.
- **Wales and Northern Ireland as separate regimes.** Neither sets different
  income tax rates today.
- **The real 2027/28 threshold freeze.** UK policy currently freezes
  thresholds through 2027/28 before (presumably) uprating; this feature ships
  one toggle — inflated from the anchor year, or frozen forever — rather than
  modelling the freeze-then-uprate shape. A later refinement if it earns its
  place.
- **A per-band breakdown in the UI.** Reporting, not correctness; the
  projection's single tax figure is unchanged in shape from before this
  feature.
- **Marriage allowance, blind person's allowance, salary sacrifice**, and
  every other adjustment to taxable income. The model taxes what the plan
  already calls taxable income.
- **Multiple tax years in the table.** One entry (`2025/26`) ships today.
  Adding a second year is expected, routine work — but per "the maintenance
  hazard" above, it must also make `taxYearFor`'s fallback loud, not just
  append a row.

## Code map

| Concern | File |
|---|---|
| `Regime`, `Band`, `TaxYear`, `TaxContext` | [`src/lib/tax/types.ts`](../../src/lib/tax/types.ts) |
| Band data (`2025/26`, `RUK`/`SCOTLAND`), `taxYearFor`, `bandsFor`, `taxContextFor` | [`src/lib/tax/bands.ts`](../../src/lib/tax/bands.ts) |
| `taxOn` (forward), `grossFor` (inverse) | [`src/lib/tax/compute.ts`](../../src/lib/tax/compute.ts) |
| Which wrappers are taxed on withdrawal (`PENSION`, `GIA`) | [`src/lib/plan/tax.ts`](../../src/lib/plan/tax.ts) |
| One tax context per year; `incTax` from income, threaded into `fundDeficit` | [`src/lib/plan/project.ts`](../../src/lib/plan/project.ts) |
| `fundDeficit`: drains taxable pots, accumulates `taxedSoFar` across pots | [`src/lib/plan/assets.ts`](../../src/lib/plan/assets.ts) |
| `Plan.taxRegime`, `Plan.thresholdsInflationLinked`, `TaxRegime` enum | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| Regime picker + inflation-linked checkbox (replaces the old `Tax rate %` field) | [`src/app/(app)/plan/AssumptionsPanel.tsx`](<../../src/app/(app)/plan/AssumptionsPanel.tsx>) |

### Testing

- **Unit** — [`src/__tests__/tax/compute.test.ts`](../../src/__tests__/tax/compute.test.ts)
  (the walk both directions: allowance boundary, basic/higher/additional
  bands, the taper's 60% equivalence, Scottish boundaries, the
  `grossFor`/`taxOn` inverse property), [`src/__tests__/tax/bands.test.ts`](../../src/__tests__/tax/bands.test.ts)
  (the inflation anchor: scale 1 through the anchor year, compounding after,
  toggle off pins scale at 1 indefinitely), [`src/lib/plan/tax.test.ts`](../../src/lib/plan/tax.test.ts)
  (`isTaxableOnWithdrawal`), [`src/lib/plan/project.test.ts`](../../src/lib/plan/project.test.ts)
  and [`src/lib/plan/assets.test.ts`](../../src/lib/plan/assets.test.ts)
  (the double-allowance case: income plus a withdrawal taxed as one income,
  not two; a drawdown that fits inside the unused allowance costs nothing;
  `thresholdsInflationLinked` leaves year-0 tax unchanged but strictly lowers
  later years' tax).
- **Integration** — [`src/__tests__/plan/taxRegime.int.test.ts`](../../src/__tests__/plan/taxRegime.int.test.ts)
  (a plan round-trips `taxRegime`/`thresholdsInflationLinked`; the projection
  changes when the regime changes).
- **No e2e.** Nothing here is a journey; it's arithmetic behind the existing
  Assumptions panel and projection screens.

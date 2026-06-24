# Plan Return Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plan-level return-spread (±%) so the forecast shows a band of outcomes — three deterministic engine passes (low/mid/high), a verdict expressed as a range anchored on the expected (mid) case, and a shaded cone on the net-worth and liquid-assets charts.

**Architecture:** The engine stays pure and deterministic. A new `returnDeltaPct` parameter on the internal `projectYears` shifts every asset's effective return; `projectWithBand` runs three passes (−spread / 0 / +spread). The mid pass is byte-for-byte today's `project()`. Deflation to today's money runs per pass, after which a pure helper derives the verdict ranges from the deflated peaks. Chart-data transforms produce Recharts **range-area** rows (`[low, high]` tuples) so the cone renders directly and handles negative net worth.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Prisma 7 (Postgres/Supabase), zod, styled-components, Recharts 3, Jest + RTL (jsdom unit), Playwright (e2e), Biome.

## Global Constraints

- **Biome bans the non-null assertion `!`** — never write `x!`; use explicit guards / `?.` / `??`.
- **`pnpm verify` (`typecheck && biome ci && test`) is the finish gate** — `biome ci` is stricter than `biome check`; run `pnpm format` to fix formatting before committing.
- **Migrations are container-only to author** (`make migrate-create name=<verb_table>`); never run `pnpm prisma migrate` on the host bare (it reads `.env` = prod). Applying to `halcyon_test` is allowed only with explicitly env-pinned `DATABASE_URL`/`DIRECT_URL`.
- **Editing→chart convention:** a server action that mutates plan data is followed by `router.refresh()` in the client editor (not just `revalidatePath`), so the server-rendered chart/verdict re-render.
- **Charts are not unit-tested** (Recharts doesn't render under jsdom) — pure chart-data transforms in `src/lib/plan/chartData.ts` ARE unit-tested; chart components are covered by e2e + a live pass.
- **Currency display** goes through `formatAmount(currency, value, numberFormat)` from `@/lib/settings/currency`.
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Spread is uniform**: it shifts every asset's effective return (`expectedReturnPct ?? defaultReturnPct`) by the same ±%. No clamping on the low pass (negative returns are realistic).
- **Opt-in default `0`**: a `±0` spread makes all three passes identical, so existing plans look exactly as today. New plans get `2` via `createPlan`.

---

### Task 1: Prisma migration — `returnSpreadPct` column

**Files:**
- Modify: `prisma/schema.prisma` (the `Plan` model, after `defaultReturnPct`)
- Create: `prisma/migrations/<timestamp>_add_return_spread/migration.sql` (generated)

**Interfaces:**
- Produces: a `Plan.returnSpreadPct` column (`Decimal(5,2)`, default `0`), surfaced on the generated `@prisma/client` `Plan` type as `Prisma.Decimal`.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, inside `model Plan`, add the line immediately after `defaultReturnPct`:

```prisma
  defaultReturnPct   Decimal  @default(5) @db.Decimal(5, 2)
  returnSpreadPct    Decimal  @default(0) @db.Decimal(5, 2)
  blendedTaxRatePct  Decimal  @default(20) @db.Decimal(5, 2)
```

- [ ] **Step 2: Author the migration in the container**

Run: `make migrate-create name=add_return_spread`
Expected: a new `prisma/migrations/<timestamp>_add_return_spread/migration.sql` is created and applied to the local `halcyon` DB; the SQL contains `ADD COLUMN "returnSpreadPct" DECIMAL(5,2) NOT NULL DEFAULT 0`.

- [ ] **Step 3: Apply the migration to the integration-test DB**

Run (env-pinned to `halcyon_test`, safe — does not touch prod):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
npx prisma migrate deploy
```

Expected: `No pending migrations to apply.` is NOT printed — it reports applying `add_return_spread` (or, if already applied, the deploy is idempotent and succeeds).

- [ ] **Step 4: Verify the client type regenerated**

Run: `pnpm prisma generate && pnpm typecheck`
Expected: PASS. `Plan` now carries `returnSpreadPct`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(plan): add returnSpreadPct column to Plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Engine — `returnDeltaPct` + `projectWithBand` + band types

**Files:**
- Modify: `src/lib/plan/types.ts` (add `PlanInput.returnSpreadPct`, `BandedVerdict`, `BandedProjection`)
- Modify: `src/lib/plan/project.ts` (`returnDeltaPct` param on `projectYears`; new `projectWithBand`)
- Modify: `src/lib/plan/index.ts` (export `projectWithBand`, `BandedProjection`, `BandedVerdict`)
- Test: `src/lib/plan/project.test.ts` (new `describe("projectWithBand")`)

**Interfaces:**
- Consumes: existing `projectYears` (internal), `summarise` (verdict.ts), `earliestSustainableRetirementAge` (project.ts), `PlanInput`, `YearProjection`, `Verdict`, `PlanProjection`.
- Produces:
  - `PlanInput.returnSpreadPct?: number` (default 0 when absent).
  - `interface BandedVerdict extends Verdict { firstShortfallAgeRange: [number, number] | null; peakNetWorthRange: [number, number] }`
  - `interface BandedProjection { low: YearProjection[]; mid: YearProjection[]; high: YearProjection[]; verdict: BandedVerdict }`
  - `projectWithBand(input: PlanInput): { low: PlanProjection; mid: PlanProjection; high: PlanProjection }` — three **nominal** projections; deflation + range assembly happen in Task 3.

- [ ] **Step 1: Add the types**

In `src/lib/plan/types.ts`, add `returnSpreadPct` to `PlanInput` (after `defaultReturnPct`):

```ts
  defaultReturnPct: number;
  returnSpreadPct?: number; // ± shift applied to every asset's return for the low/high passes; default 0
```

At the end of the file, after `PlanProjection`, add:

```ts
export interface BandedVerdict extends Verdict {
  // [min, max] across the three passes. firstShortfallAgeRange is null only when
  // no pass ever shorts. peakNetWorthRange is in today's money (assembled post-deflation).
  firstShortfallAgeRange: [number, number] | null;
  peakNetWorthRange: [number, number];
}

export interface BandedProjection {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  verdict: BandedVerdict;
}
```

- [ ] **Step 2: Write the failing engine tests**

In `src/lib/plan/project.test.ts`, add a new import and a `describe` block at the end:

```ts
import {
  earliestSustainableRetirementAge,
  project,
  projectWithBand,
} from "./project";
```

```ts
describe("projectWithBand", () => {
  const banded = (over: Partial<PlanInput> = {}) =>
    base({
      planToAge: 60,
      defaultReturnPct: 5,
      returnSpreadPct: 2,
      assets: [
        {
          id: "a",
          label: "GIA",
          wrapper: "GIA",
          openingValue: 100000,
          drawdownPriority: 1,
        },
      ],
      ...over,
    });

  it("mid pass equals plain project()", () => {
    const input = banded();
    const b = projectWithBand(input);
    expect(b.mid.years).toEqual(project(input).years);
  });

  it("high pass beats mid beats low on net worth every year", () => {
    const b = projectWithBand(banded());
    for (let i = 0; i < b.mid.years.length; i++) {
      const lo = at(b.low, i).netWorth;
      const mid = at(b.mid, i).netWorth;
      const hi = at(b.high, i).netWorth;
      expect(lo).toBeLessThanOrEqual(mid);
      expect(mid).toBeLessThanOrEqual(hi);
    }
  });

  it("collapses to three identical passes when spread is 0", () => {
    const b = projectWithBand(banded({ returnSpreadPct: 0 }));
    expect(b.low.years).toEqual(b.mid.years);
    expect(b.high.years).toEqual(b.mid.years);
  });

  it("treats absent spread as 0", () => {
    const input = banded({ returnSpreadPct: undefined });
    const b = projectWithBand(input);
    expect(b.low.years).toEqual(b.mid.years);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `make test name=projectWithBand`
Expected: FAIL — `projectWithBand` is not exported.

- [ ] **Step 4: Add the `returnDeltaPct` parameter to `projectYears`**

In `src/lib/plan/project.ts`, change the `projectYears` signature and the single `grow` call. Signature:

```ts
const projectYears = (
  input: PlanInput,
  returnDeltaPct = 0,
): YearProjection[] => {
```

The asset-growth loop (currently lines ~125-130) becomes:

```ts
    for (const a of runAssets) {
      assetBal[a.id] = grow(
        assetBal[a.id] ?? 0,
        (a.expectedReturnPct ?? input.defaultReturnPct) + returnDeltaPct,
      );
    }
```

(With the default `0`, this is identical to today — `project()` and `earliestSustainableRetirementAge` keep calling `projectYears(input)` unchanged.)

- [ ] **Step 5: Add `projectWithBand`**

In `src/lib/plan/project.ts`, add an import for the new type and the new export. Update the existing type import to include `PlanProjection` (already imported) — and add the function after `project`:

```ts
// Three deterministic passes for the return band. The spread shifts every
// asset's effective return by ±returnSpreadPct. mid === project(input). Only the
// mid pass computes earliestSustainableRetirementAge (the only pass that surfaces
// it); low/high set it null to avoid the extra projection sweep.
export const projectWithBand = (
  input: PlanInput,
): { low: PlanProjection; mid: PlanProjection; high: PlanProjection } => {
  const spread = input.returnSpreadPct ?? 0;
  const pass = (delta: number, withEarliest: boolean): PlanProjection => {
    const years = projectYears(input, delta);
    return {
      years,
      verdict: {
        ...summarise(years),
        earliestSustainableRetirementAge: withEarliest
          ? earliestSustainableRetirementAge(input)
          : null,
      },
    };
  };
  return {
    low: pass(-spread, false),
    mid: pass(0, true),
    high: pass(spread, false),
  };
};
```

- [ ] **Step 6: Export from the barrel**

In `src/lib/plan/index.ts`, add `projectWithBand` to the project export and the two new types to the type export:

```ts
export { project, projectWithBand, earliestSustainableRetirementAge } from "./project";
```

and in the `export type { ... } from "./types"` block add `BandedProjection,` and `BandedVerdict,` (keep alphabetical-ish ordering).

- [ ] **Step 7: Run tests to verify they pass**

Run: `make test name=projectWithBand` then `pnpm typecheck`
Expected: PASS (4 new tests green); typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/plan/types.ts src/lib/plan/project.ts src/lib/plan/index.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): projectWithBand — three deterministic return-band passes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Deflation + band verdict (`toTodaysMoneyBand`) + `toPlanInput` field

**Files:**
- Modify: `src/lib/plan/toPlanInput.ts` (read `returnSpreadPct` into `PlanInput`; add `toTodaysMoneyBand`)
- Test: `src/lib/plan/toPlanInput.test.ts` (new tests for `toTodaysMoneyBand`)

**Interfaces:**
- Consumes: `projectWithBand` (Task 2), `BandedProjection`, `BandedVerdict`, existing `toTodaysMoney`, `PlanWithChildren`.
- Produces: `toTodaysMoneyBand(band, inflationPct, currentAge): BandedProjection` and `PlanInput.returnSpreadPct` populated from `plan.returnSpreadPct`.

- [ ] **Step 1: Write the failing test**

In `src/lib/plan/toPlanInput.test.ts`, add tests. Use the existing test's import style; add `toTodaysMoneyBand` to the import from `./toPlanInput` and `projectWithBand` from `./project` (or build a `BandedProjection`-shaped input inline). Inline construction keeps the test pure:

```ts
import { toTodaysMoneyBand } from "./toPlanInput";
import type { PlanProjection, YearProjection } from "./types";

const yr = (age: number, netWorth: number): YearProjection => ({
  age,
  year: 2026 + (age - 40),
  grossIncome: 0,
  incomeByKind: {},
  tax: 0,
  netIncome: 0,
  expensesByCategory: {},
  totalExpenses: 0,
  liabilityRepayments: 0,
  surplus: 0,
  contributions: 0,
  withdrawals: 0,
  assets: [],
  liabilities: [],
  liabilitiesTotal: 0,
  netWorth,
  shortfall: netWorth < 0,
});

const proj = (peakAge: number, peak: number, years: YearProjection[]): PlanProjection => ({
  years,
  verdict: {
    feasible: years.every((y) => !y.shortfall),
    firstShortfallAge: years.find((y) => y.shortfall)?.age ?? null,
    peakNetWorth: { age: peakAge, value: peak },
    earliestSustainableRetirementAge: null,
  },
});

describe("toTodaysMoneyBand", () => {
  it("anchors the verdict on mid and derives ranges from deflated peaks", () => {
    // inflation 0 so deflation is identity — ranges equal nominal min/max.
    const low = proj(40, 80, [yr(40, 80)]);
    const mid = proj(40, 100, [yr(40, 100)]);
    const high = proj(40, 130, [yr(40, 130)]);
    const banded = toTodaysMoneyBand({ low, mid, high }, 0, 40);

    expect(banded.verdict.peakNetWorth.value).toBe(100); // anchored on mid
    expect(banded.verdict.peakNetWorthRange).toEqual([80, 130]);
    expect(banded.mid).toEqual(mid.years);
  });

  it("reports a shortfall-age range and null when no pass shorts", () => {
    const noShort = proj(40, 100, [yr(40, 100)]);
    const allClear = toTodaysMoneyBand(
      { low: noShort, mid: noShort, high: noShort },
      0,
      40,
    );
    expect(allClear.verdict.firstShortfallAgeRange).toBeNull();

    const low = proj(40, -10, [yr(40, 100), yr(41, -10)]);
    const mid = proj(40, 100, [yr(40, 100), yr(41, 50)]);
    const high = proj(40, 100, [yr(40, 100), yr(41, 80)]);
    const banded = toTodaysMoneyBand({ low, mid, high }, 0, 40);
    expect(banded.verdict.firstShortfallAgeRange).toEqual([41, 41]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test name=toTodaysMoneyBand`
Expected: FAIL — `toTodaysMoneyBand` is not exported.

- [ ] **Step 3: Read `returnSpreadPct` in `toPlanInput`**

In `src/lib/plan/toPlanInput.ts`, in the returned `PlanInput` object (after `defaultReturnPct: num(plan.defaultReturnPct),`), add:

```ts
    defaultReturnPct: num(plan.defaultReturnPct),
    returnSpreadPct: num(plan.returnSpreadPct),
    taxRatePct: num(plan.blendedTaxRatePct),
```

- [ ] **Step 4: Add `toTodaysMoneyBand`**

In `src/lib/plan/toPlanInput.ts`, update the type import to include the band types and add the function after `toTodaysMoney`:

```ts
import type {
  BandedProjection,
  BandedVerdict,
  Growth,
  PlanInput,
  PlanProjection,
} from "@/lib/plan";
```

```ts
// Deflates each pass to today's money, then assembles the BandedVerdict ranges
// from the *deflated* peaks (each pass peaks at its own age, and deflation is
// age-dependent — so the range must be taken after deflation, never by deflating
// a pre-computed nominal range). The headline verdict is anchored on mid.
export function toTodaysMoneyBand(
  band: { low: PlanProjection; mid: PlanProjection; high: PlanProjection },
  inflationPct: number,
  currentAge: number,
): BandedProjection {
  const low = toTodaysMoney(band.low, inflationPct, currentAge);
  const mid = toTodaysMoney(band.mid, inflationPct, currentAge);
  const high = toTodaysMoney(band.high, inflationPct, currentAge);

  const peaks = [low, mid, high].map((p) => p.verdict.peakNetWorth.value);
  const shortfalls = [low, mid, high]
    .map((p) => p.verdict.firstShortfallAge)
    .filter((a): a is number => a !== null);

  const verdict: BandedVerdict = {
    ...mid.verdict,
    peakNetWorthRange: [Math.min(...peaks), Math.max(...peaks)],
    firstShortfallAgeRange:
      shortfalls.length > 0
        ? [Math.min(...shortfalls), Math.max(...shortfalls)]
        : null,
  };

  return { low: low.years, mid: mid.years, high: high.years, verdict };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `make test name=toTodaysMoneyBand` then `pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/toPlanInput.ts src/lib/plan/toPlanInput.test.ts
git commit -m "feat(plan): toTodaysMoneyBand — per-pass deflation + verdict ranges

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Chart-data band transforms

**Files:**
- Modify: `src/lib/plan/chartData.ts` (`toNetWorthBandData`, `toLiquidAssetsBandData`)
- Test: `src/lib/plan/chartData.test.ts` (new tests)

**Interfaces:**
- Consumes: existing `toNetWorthChartData`, `toLiquidAssetsChartData`, `NetWorthDatum`, `LiquidAssetsDatum`, `YearProjection`.
- Produces:
  - `type NetWorthBandDatum = NetWorthDatum & { nwRange: [number, number] }`
  - `toNetWorthBandData(low, mid, high): NetWorthBandDatum[]` — mid composition + a `[low, high]` net-worth range per year.
  - `type LiquidBandDatum = LiquidAssetsDatum & { totalRange: [number, number] }`
  - `toLiquidAssetsBandData(low, mid, high): LiquidBandDatum[]`

- [ ] **Step 1: Write the failing tests**

In `src/lib/plan/chartData.test.ts`, add (reuse whatever `YearProjection` factory the file already has; if none, a minimal inline builder mirroring Task 3's `yr` works — assets carry `{ wrapper, value }`):

```ts
import { toLiquidAssetsBandData, toNetWorthBandData } from "./chartData";
```

```ts
describe("toNetWorthBandData", () => {
  it("carries a sorted [low, high] net-worth range alongside the mid composition", () => {
    const mk = (nw: number) =>
      [{ age: 40, netWorth: nw, liabilitiesTotal: 0, assets: [{ id: "x", label: "X", wrapper: "GIA", value: nw, contributed: 0, withdrawn: 0 }] } as unknown as YearProjection];
    const rows = toNetWorthBandData(mk(80), mk(100), mk(130));
    expect(rows[0]?.netWorth).toBe(100);
    expect(rows[0]?.nwRange).toEqual([80, 130]);
  });

  it("orders the range even if a low pass overtakes a high pass", () => {
    const mk = (nw: number) =>
      [{ age: 40, netWorth: nw, liabilitiesTotal: 0, assets: [] } as unknown as YearProjection];
    const rows = toNetWorthBandData(mk(130), mk(100), mk(80));
    expect(rows[0]?.nwRange).toEqual([80, 130]);
  });
});

describe("toLiquidAssetsBandData", () => {
  it("carries a [low, high] total range alongside the mid pots", () => {
    const mk = (v: number) =>
      [{ age: 40, netWorth: 0, liabilitiesTotal: 0, assets: [{ id: "c", label: "Cash", wrapper: "CASH", value: v, contributed: 0, withdrawn: 0 }] } as unknown as YearProjection];
    const rows = toLiquidAssetsBandData(mk(20), mk(50), mk(70));
    expect(rows[0]?.total).toBe(50);
    expect(rows[0]?.totalRange).toEqual([20, 70]);
  });
});
```

(If `chartData.test.ts` already imports `YearProjection`, reuse it; otherwise add `import type { YearProjection } from "@/lib/plan";`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test name="BandData"`
Expected: FAIL — transforms not exported.

- [ ] **Step 3: Implement the transforms**

In `src/lib/plan/chartData.ts`, after `wrappersPresent` add:

```ts
export type NetWorthBandDatum = NetWorthDatum & { nwRange: [number, number] };

// mid pass supplies the stacked-wrapper composition + the netWorth line; low/high
// supply the [min, max] net-worth range for the shaded cone. Range is ordered so a
// crossing (rare, only with mixed-sign assets) never produces an inverted band.
export function toNetWorthBandData(
  low: YearProjection[],
  mid: YearProjection[],
  high: YearProjection[],
): NetWorthBandDatum[] {
  return toNetWorthChartData(mid).map((row, i) => {
    const lo = low[i]?.netWorth ?? row.netWorth;
    const hi = high[i]?.netWorth ?? row.netWorth;
    return { ...row, nwRange: [Math.min(lo, hi), Math.max(lo, hi)] };
  });
}
```

and after `liquidWrappersPresent` add:

```ts
export type LiquidBandDatum = LiquidAssetsDatum & {
  totalRange: [number, number];
};

export function toLiquidAssetsBandData(
  low: YearProjection[],
  mid: YearProjection[],
  high: YearProjection[],
): LiquidBandDatum[] {
  const total = (years: YearProjection[], i: number): number =>
    years[i]?.assets
      .filter((a) => LIQUID_WRAPPERS.includes(a.wrapper))
      .reduce((s, a) => s + a.value, 0) ?? 0;

  return toLiquidAssetsChartData(mid).map((row, i) => {
    const lo = total(low, i);
    const hi = total(high, i);
    return { ...row, totalRange: [Math.min(lo, hi), Math.max(lo, hi)] };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test name="BandData"` then `pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/chartData.ts src/lib/plan/chartData.test.ts
git commit -m "feat(plan): net-worth + liquid band chart-data transforms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Persist + edit the spread (field end-to-end, band not yet rendered)

**Files:**
- Modify: `src/lib/plan/schemas.ts` (`updatePlanAssumptionsSchema`)
- Modify: `src/lib/plan/schemas.test.ts` (`validAssumptions` fixture + a new case)
- Modify: `src/app/plan/actions.ts` (`updatePlanAssumptions` data; `createPlan` sets `returnSpreadPct: 2`)
- Modify: `src/app/plan/serialized.ts` (`SerializedPlanAssumptions`)
- Modify: `src/app/plan/page.tsx` (serialize `returnSpreadPct`)
- Modify: `src/app/plan/AssumptionsPanel.tsx` (save payload + new editable field)
- Modify: `src/__tests__/plan/updateActions.int.test.ts` (existing call + new assertion)

**Interfaces:**
- Consumes: `SerializedPlanAssumptions`, `NumberCell`, `updatePlanAssumptions`.
- Produces: `updatePlanAssumptionsSchema` requires `returnSpreadPct: number (0..10)`; `SerializedPlanAssumptions.returnSpreadPct: number`; an editable "Return spread ±%" field that persists.

- [ ] **Step 1: Write the failing schema test**

In `src/lib/plan/schemas.test.ts`, add `returnSpreadPct: 2` to the `validAssumptions` fixture (after `defaultReturnPct: 5,`), and add a case inside `describe("updatePlanAssumptionsSchema")`:

```ts
  it("rejects an out-of-range returnSpreadPct", () => {
    expect(() =>
      updatePlanAssumptionsSchema.parse({ ...validAssumptions, returnSpreadPct: 11 }),
    ).toThrow();
    expect(() =>
      updatePlanAssumptionsSchema.parse({ ...validAssumptions, returnSpreadPct: -1 }),
    ).toThrow();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="updatePlanAssumptionsSchema"`
Expected: FAIL — `validAssumptions` lacks `returnSpreadPct` (the existing "accepts valid input" case now also fails because the new field is required), and the new range case fails because the field isn't in the schema.

- [ ] **Step 3: Add the field to the schema**

In `src/lib/plan/schemas.ts`, in `updatePlanAssumptionsSchema`, after `defaultReturnPct`:

```ts
  defaultReturnPct: z.number().min(-20).max(30),
  returnSpreadPct: z.number().min(0).max(10),
  blendedTaxRatePct: z.number().min(0).max(60),
```

- [ ] **Step 4: Run to verify the schema tests pass**

Run: `make test name="updatePlanAssumptionsSchema"`
Expected: PASS.

- [ ] **Step 5: Thread the field through serialized + page**

In `src/app/plan/serialized.ts`, add to `SerializedPlanAssumptions` (after `defaultReturnPct: number;`):

```ts
  defaultReturnPct: number;
  returnSpreadPct: number;
  blendedTaxRatePct: number;
```

In `src/app/plan/page.tsx`, in the `serialized.assumptions` object (after `defaultReturnPct: Number(plan.defaultReturnPct),`):

```ts
      defaultReturnPct: Number(plan.defaultReturnPct),
      returnSpreadPct: Number(plan.returnSpreadPct),
      blendedTaxRatePct: Number(plan.blendedTaxRatePct),
```

- [ ] **Step 6: Persist in the action + default for new plans**

In `src/app/plan/actions.ts`, in `updatePlanAssumptions`'s `data` (after `defaultReturnPct: p.defaultReturnPct,`):

```ts
      defaultReturnPct: p.defaultReturnPct,
      returnSpreadPct: p.returnSpreadPct,
      blendedTaxRatePct: p.blendedTaxRatePct,
```

In `createPlan`'s `tx.plan.create({ data: { ... } })`, add `returnSpreadPct: 2,` (after `retirementAge,`):

```ts
        retirementAge,
        returnSpreadPct: 2,
        statePensionAge: 67,
```

- [ ] **Step 7: Add the editable field + save payload**

In `src/app/plan/AssumptionsPanel.tsx`, in the `save` payload object (after `defaultReturnPct: next.defaultReturnPct,`):

```ts
        defaultReturnPct: next.defaultReturnPct,
        returnSpreadPct: next.returnSpreadPct,
        blendedTaxRatePct: next.blendedTaxRatePct,
```

And add a new `<Field>` after the "Default return %" field:

```tsx
        <Field>
          Return spread ±%
          <NumberCell
            value={a.returnSpreadPct}
            step="0.1"
            onCommit={(v) =>
              save({ ...a, returnSpreadPct: v ?? a.returnSpreadPct })
            }
          />
        </Field>
```

- [ ] **Step 8: Fix + extend the integration test**

In `src/__tests__/plan/updateActions.int.test.ts`, the existing `updatePlanAssumptions(...)` call is missing the now-required `returnSpreadPct`. Add `returnSpreadPct: 3,` to that call's input object, and after the existing persistence assertions add:

```ts
    const after = defined(
      await prisma.plan.findUnique({ where: { id: plan.id } }),
      "updated plan",
    );
    expect(Number(after.returnSpreadPct)).toBe(3);
```

(If the test already fetches the updated plan, reuse that variable instead of re-fetching.)

- [ ] **Step 9: Run the unit + integration tests**

Run: `make test name="schemas"` then
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public pnpm test:int -- updateActions`
Expected: PASS. Then `pnpm typecheck` — clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/plan/schemas.ts src/lib/plan/schemas.test.ts src/app/plan/actions.ts src/app/plan/serialized.ts src/app/plan/page.tsx src/app/plan/AssumptionsPanel.tsx src/__tests__/plan/updateActions.int.test.ts
git commit -m "feat(plan): persist + edit returnSpreadPct (band not yet rendered)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Render the band (page → charts + verdict)

> Typecheck goes green only at the END of this task — the chart/verdict prop shapes change bottom-up and `PlanView` + `page.tsx` are rewired last. This is expected (same interdependency pattern as the D1 drawer build).

**Files:**
- Modify: `src/app/plan/NetWorthChart.tsx` (props → low/mid/high; add cone)
- Modify: `src/app/plan/LiquidAssetsChart.tsx` (props → low/mid/high; add cone)
- Modify: `src/app/plan/ChartPanel.tsx` (props → low/mid/high)
- Modify: `src/app/plan/VerdictBanner.tsx` (accept `BandedVerdict`; show ranges)
- Modify: `src/app/plan/PlanView.tsx` (accept `band: BandedProjection`)
- Modify: `src/app/plan/page.tsx` (use `projectWithBand` + `toTodaysMoneyBand`)

**Interfaces:**
- Consumes: `toNetWorthBandData`, `toLiquidAssetsBandData` (Task 4), `projectWithBand`, `toTodaysMoneyBand` (Tasks 2-3), `BandedProjection`, `BandedVerdict`.
- Produces: `NetWorthChart`/`LiquidAssetsChart`/`ChartPanel` take `low`/`mid`/`high: YearProjection[]`; `VerdictBanner` takes `verdict: BandedVerdict`; `PlanView` takes `band: BandedProjection`.

- [ ] **Step 1: Net-worth cone**

In `src/app/plan/NetWorthChart.tsx`, change the import and props. Replace the data import line with:

```ts
import { toNetWorthBandData, wrappersPresent } from "@/lib/plan/chartData";
```

Change the component signature + data:

```tsx
export function NetWorthChart({
  low,
  mid,
  high,
  currency,
  numberFormat,
}: {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toNetWorthBandData(low, mid, high);
  const wrappers = wrappersPresent(data);
```

Add the cone as the FIRST series inside `<ComposedChart>` (before the wrapper `<Area>`s, so it renders behind them), using Recharts range-area (`dataKey` resolving to a `[low, high]` tuple):

```tsx
        <Area
          type="monotone"
          dataKey="nwRange"
          name="Return range"
          fill={NET_WORTH_COLOUR}
          fillOpacity={0.08}
          stroke="none"
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
```

(`NET_WORTH_COLOUR` is already imported.)

- [ ] **Step 2: Liquid cone**

In `src/app/plan/LiquidAssetsChart.tsx`, replace the data import with:

```ts
import {
  liquidWrappersPresent,
  toLiquidAssetsBandData,
} from "@/lib/plan/chartData";
```

Change the signature + data exactly as in Step 1 (low/mid/high), then `const data = toLiquidAssetsBandData(low, mid, high);` and `const wrappers = liquidWrappersPresent(data);`. Add the cone before the wrapper `<Area>`s:

```tsx
        <Area
          type="monotone"
          dataKey="totalRange"
          name="Return range"
          fill={NET_WORTH_COLOUR}
          fillOpacity={0.08}
          stroke="none"
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
```

- [ ] **Step 3: ChartPanel passes low/mid/high**

In `src/app/plan/ChartPanel.tsx`, change props and the three chart usages:

```tsx
export function ChartPanel({
  low,
  mid,
  high,
  currency,
  numberFormat,
}: {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
```

- `NetWorthChart`: `<NetWorthChart low={low} mid={mid} high={high} currency={currency} numberFormat={numberFormat} />`
- `CashFlowChart`: `<CashFlowChart years={mid} currency={currency} numberFormat={numberFormat} />` (cash flow stays single-pass; uses mid)
- `LiquidAssetsChart`: `<LiquidAssetsChart low={low} mid={mid} high={high} currency={currency} numberFormat={numberFormat} />`

- [ ] **Step 4: VerdictBanner shows ranges**

In `src/app/plan/VerdictBanner.tsx`, change the type import and prop type from `Verdict` to `BandedVerdict`:

```ts
import type { BandedVerdict } from "@/lib/plan";
```

```tsx
export function VerdictBanner({
  verdict,
  currency,
  numberFormat,
}: {
  verdict: BandedVerdict;
  currency: string;
  numberFormat: NumberFormat;
}) {
```

After the existing `const peak = ...` line, derive the range strings (only shown when the band is non-trivial):

```tsx
  const [peakLo, peakHi] = verdict.peakNetWorthRange;
  const peakRange =
    peakLo !== peakHi
      ? `${formatAmount(currency, peakLo, numberFormat)}–${formatAmount(currency, peakHi, numberFormat)}`
      : null;
  const shortRange =
    verdict.firstShortfallAgeRange &&
    verdict.firstShortfallAgeRange[0] !== verdict.firstShortfallAgeRange[1]
      ? verdict.firstShortfallAgeRange
      : null;
```

Append a qualifier to the not-feasible headline. Replace the `headline` definition with:

```tsx
  const headline = verdict.feasible
    ? "Your money lasts the plan"
    : shortRange
      ? `Your money runs short at age ${verdict.firstShortfallAge} (between ${shortRange[0]} and ${shortRange[1]} depending on returns)`
      : `Your money runs short at age ${verdict.firstShortfallAge}`;
```

Add a range line under the peak-net-worth stat value:

```tsx
          <StatVal>
            {peak} <small>· age {verdict.peakNetWorth.age}</small>
          </StatVal>
          {peakRange ? <RangeNote>range {peakRange}</RangeNote> : null}
```

And under the "Money runs out" stat value (inside the `$danger` branch):

```tsx
              <StatVal $danger>Age {verdict.firstShortfallAge}</StatVal>
              {shortRange ? (
                <RangeNote>
                  range {shortRange[0]}–{shortRange[1]}
                </RangeNote>
              ) : null}
```

Add the `RangeNote` styled component near `StatVal`:

```tsx
const RangeNote = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;
```

- [ ] **Step 5: PlanView takes the band**

In `src/app/plan/PlanView.tsx`, change the type import (`Verdict` → `BandedProjection`) and props. Replace the `years`/`verdict` props with `band`:

```tsx
import type { BandedProjection } from "@/lib/plan";
```

```tsx
export function PlanView({
  band,
  plan,
  currency,
  numberFormat,
}: {
  band: BandedProjection;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
}) {
```

Update the three consumers (mid is the primary series for the verdict anchor, timeline axis, and cash flow):

- `VerdictBanner`: `verdict={band.verdict}`
- `ChartPanel`: `<ChartPanel low={band.low} mid={band.mid} high={band.high} currency={currency} numberFormat={numberFormat} />`
- `Timeline` age bounds: `minAge={band.mid[0]?.age ?? 0}` and `maxAge={band.mid[band.mid.length - 1]?.age ?? 0}`

- [ ] **Step 6: page.tsx computes the band**

In `src/app/plan/page.tsx`, change the import and the projection lines:

```ts
import { projectWithBand } from "@/lib/plan";
import { toPlanInput, toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
```

```ts
  const input = toPlanInput(plan, asOfYear);
  const band = toTodaysMoneyBand(
    projectWithBand(input),
    input.inflationPct,
    input.currentAge,
  );
```

And the render:

```tsx
  return (
    <PlanView
      band={band}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
```

- [ ] **Step 7: Full pre-flight**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: all PASS (typecheck now green; no unit regressions — chart components aren't unit-tested).

- [ ] **Step 8: Commit**

```bash
git add src/app/plan/NetWorthChart.tsx src/app/plan/LiquidAssetsChart.tsx src/app/plan/ChartPanel.tsx src/app/plan/VerdictBanner.tsx src/app/plan/PlanView.tsx src/app/plan/page.tsx
git commit -m "feat(plan): render return-band cone on net-worth + liquid, verdict ranges

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: E2E + live verification

**Files:**
- Modify: `e2e/plan.spec.ts` (assert the spread field persists + a range qualifier appears)

**Interfaces:**
- Consumes: the running app on `:3100` (Playwright) with a seeded plan.

- [ ] **Step 1: Add an e2e assertion for the spread field**

In `e2e/plan.spec.ts`, follow the existing pattern for editing an assumption (locate the assumptions panel, set a value, assert it persists after reload). Add a step that sets "Return spread ±%" to a value and asserts it round-trips. Mirror the existing assumption-edit test's locators (e.g. `getByLabel`/`getByRole("spinbutton")` scoped to the Assumptions section) — copy that test and swap the field label to `Return spread ±%` and the value to `3`.

- [ ] **Step 2: Run the e2e test**

Run: `make test-e2e name="plan"`
Expected: PASS (the mock-auth + Next dev server on :3100 spin up; the spread edit persists).

- [ ] **Step 3: Live browser pass (manual, via Playwright MCP or `pnpm dev`)**

With `pnpm dev` (:3210) + local Docker `db` up, sign in as demo and on `/plan`:
1. Confirm the **net-worth** view shows a faint shaded cone around the net-worth line, and **liquid assets** likewise.
2. Confirm **cash flow** is unchanged (bars, no cone).
3. Edit "Return spread ±%" in Assumptions from 2 → 5; confirm the cone visibly widens after the refresh.
4. Set it to 0; confirm the cone collapses to a single line and the verdict drops its range qualifier.
5. Confirm the verdict shows "(between X and Y …)" and the stat "range …" lines when spread > 0.

Document the result in the PR description (cones can't be asserted under jsdom — this live pass is the coverage, per the charts convention).

- [ ] **Step 4: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): drive the return-spread field on /plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Finishing the branch

After Task 7, run the full local pre-flight and open the PR:

- `pnpm verify` (typecheck + `biome ci` + unit) — fix any `biome ci` formatting with `pnpm format`.
- `pnpm test:int` (env-pinned to `halcyon_test`).
- `make test-e2e name="plan"`.
- Push `feat/plan-return-band`, open the PR, `gh pr checks <n> --watch`, then `gh pr merge <n> --merge --delete-branch` once green (never `--auto`). `migrate-prod` runs on merge to master and applies `add_return_spread` to production Supabase before Vercel deploys.

## Self-Review

**Spec coverage:**
- §1 data model → Task 1 (column, default 0) + Task 5 (createPlan sets 2). ✓
- §2 engine (uniform spread, no clamp, mid===today, BandedVerdict, earliest mid-only) → Task 2. ✓
- §2 deflation-order contract → Task 3 (`toTodaysMoneyBand` derives ranges post-deflation). ✓
- §3 wiring (toPlanInput, page, serialized) → Tasks 3 + 5 + 6. ✓
- §4 charts (net worth + liquid cones, cash flow untouched) → Task 4 (transforms) + Task 6 (rendering). ✓
- §5 UI (assumptions field, verdict ranges + qualifier shown only when band non-trivial) → Task 5 (field) + Task 6 (verdict). ✓
- §6 testing (engine units, chartData units, schema, int, e2e + live) → Tasks 2,3,4,5,7. ✓
- Backward compat (±0 indistinguishable) → asserted in Task 2 Step 2 + Task 6 Step 4 (range hidden when min===max). ✓

**Placeholder scan:** No TBD/TODO; every code step shows the code. The e2e step (Task 7 Step 1) says "mirror the existing assumption-edit test" because the exact locators depend on the current `plan.spec.ts` contents — the implementer copies a concrete neighbouring test rather than inventing locators. Acceptable: it points at an existing, real pattern.

**Type consistency:** `projectWithBand` returns `{ low, mid, high }` of `PlanProjection` (Task 2); `toTodaysMoneyBand` consumes exactly that shape and returns `BandedProjection` with `low/mid/high: YearProjection[]` + `verdict: BandedVerdict` (Task 3). Charts/ChartPanel consume `low/mid/high: YearProjection[]` (Task 6). `PlanView` consumes `band: BandedProjection` and threads `band.low/mid/high` + `band.verdict` (Task 6). `toNetWorthBandData`/`toLiquidAssetsBandData` signatures `(low, mid, high)` match the chart call sites. `returnSpreadPct` is `number` everywhere (PlanInput optional, serialized/schema required). Consistent. ✓

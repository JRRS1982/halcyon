# Plan Asset Fees + Pension Access Age — Design (D3)

**Date:** 2026-06-24
**Status:** Approved (brainstorm)
**Feature area:** `/plan` life-planning — first of the "more per-element drawer fields" follow-ups after the redesign arc completed (#69/#70/#71/#72/#73). Adds two genuinely-asked-for per-asset settings the drawer's `Growth` and `Drawdown` sections were built to hold.

## Problem

Two per-asset realities the forecast can't currently express:

1. **Fees / charges.** A platform + fund charge (e.g. 0.45%/yr) is the single
   biggest reason a real projection diverges from a naive one, compounding over
   decades. There is no way to enter it; users overstate growth.
2. **Pension access age.** UK pensions cannot be drawn before a minimum age
   (57). Today the engine will happily drain a pension at 55 to fund an early
   retirement, overstating feasibility for anyone retiring before 57.

Both are common, concrete asks; both slot into existing (currently sparse)
drawer sections. Out of scope: contribution escalation, liability repayment type,
expense growth overrides (the rest of the D3 table — separate future work).

## Decision summary

- **`feePct`** — per-asset annual charge %, subtracted from the asset's effective
  return. Opt-in (default 0); existing plans unchanged.
- **`minAccessAge`** — earliest age an asset may be drawn down. Pension-only in
  the UI, defaulting to 57 via an engine/UI fallback (`null → 57` for the PENSION
  wrapper) so no data backfill is needed and existing pensions lock at 57
  automatically (a deliberate correctness change, not opt-in).

## Design

### 1. Data model — one migration

Two columns on `PlanAsset`:

```prisma
feePct        Decimal @default(0) @db.Decimal(5, 2)
minAccessAge  Int?
```

- `feePct` DB default `0` → fees opt-in, no projection change for existing plans.
- `minAccessAge` nullable, **no DB default / no backfill**. The 57 default is
  applied in engine + UI logic keyed on the PENSION wrapper (§2, §3), so existing
  pensions lock at 57 with no data migration, and non-pension assets are never
  restricted.
- Migration authored container-only (`make migrate-create name=add_asset_fees_access_age`),
  then applied to `halcyon_test` (env-pinned `prisma migrate deploy`).

### 2. Engine

Two pure changes; the engine stays deterministic and the band/deflation/charts/
verdict are untouched.

**Fees** — `AssetInput` gains `feePct?: number` (default 0). The single growth line
in `project.ts` (the same line the band's `returnDeltaPct` modifies) becomes:

```ts
grow(
  balance,
  (a.expectedReturnPct ?? input.defaultReturnPct) - (a.feePct ?? 0) + returnDeltaPct,
)
```

Fees reduce the central return; the ±spread band still spans the after-fee figure.
Applies to all three band passes automatically.

**Access age** — `AssetInput` gains `minAccessAge?: number`. The drawdown function
`fundDeficit` in `assets.ts` currently does not receive the year's age — thread
`age: number` in (from the `project.ts` call site). An asset is skipped for
drawdown when locked:

```ts
const accessLimit = (a: AssetInput): number | null =>
  a.minAccessAge ?? (a.wrapper === "PENSION" ? 57 : null);
// in the drawdown order: skip `a` when accessLimit(a) !== null && age < accessLimit(a)
```

- PENSION + null ⇒ 57; PENSION + explicit value ⇒ that value; non-PENSION + null ⇒
  no restriction. (The UI only ever sets `minAccessAge` on pensions, so in practice
  only pensions are gated, but the engine rule is wrapper-driven and total.)
- This skip composes with the existing `drawable` filter (`wrapper !== "PROPERTY"`):
  PROPERTY is always excluded from drawdown; an accessible non-PROPERTY asset is
  drawn only when `age >= accessLimit`.
- Locked years that cannot be funded from any accessible asset produce a
  `shortfall` (the intended early-retirement signal).
- **Contributions are not gated** — only withdrawals. Paying into a pension before
  57 stays allowed (`contributionTargetId` / the contribution loop are unchanged).

### 3. Drawer UI

In `AssetsTable.tsx`'s `AssetFields`:

- **Fees %** → `Growth` section, `NumberCell`, `step="0.1"`, value `asset.feePct`
  (default 0), for all wrappers.
- **Earliest access age** → `Drawdown` section, rendered **only when
  `asset.wrapper === "PENSION"`**, value `asset.minAccessAge ?? 57`. `NumberCell`
  `nullable`; clearing reverts to the 57 default.

Both reuse the existing controlled `EditableCell` → `updatePlanAsset` →
`router.refresh()` path. `updatePlanAssetSchema` gains:

- `feePct: z.number().min(0).max(5)`
- `minAccessAge: z.number().int().min(50).max(75).nullable()`

The serialized asset type, `page.tsx` projection, `toPlanInput`, and the
`updatePlanAsset` action data all carry the two new fields.

### 4. Out of scope / not changed

Band, deflation, chart components, verdict, timeline — untouched. No new chart
work. `createPlanAsset` is not required to set either field (fee defaults to 0;
pension access defaults to 57 via the engine fallback), so it stays as-is.

## Files touched (anticipated)

- `prisma/schema.prisma` + new migration
- `src/lib/plan/types.ts` (`AssetInput.feePct`, `AssetInput.minAccessAge`)
- `src/lib/plan/project.ts` (fee in `grow()`; pass `age` to `fundDeficit`)
- `src/lib/plan/assets.ts` (`fundDeficit` gains `age`; access-limit skip)
- `src/lib/plan/schemas.ts` (+ test) — two new fields
- `src/lib/plan/toPlanInput.ts` (read both fields)
- `src/app/plan/serialized.ts` (`SerializedPlanAsset`)
- `src/app/plan/page.tsx` (serialize both)
- `src/app/plan/actions.ts` (`updatePlanAsset` data)
- `src/app/plan/AssetsTable.tsx` (two drawer fields, pension-gated access age)
- `src/__tests__/plan/updateActions.int.test.ts` (int: `updatePlanAsset` persists both)
- `e2e/plan.spec.ts` (drive the fee field)

## Testing

- **Engine units** (`assets.test.ts` / `project.test.ts`): a 5% asset with 1% fee
  grows at 4%; fee default 0 leaves growth unchanged; a pension is undrawable
  before its access age (early-retirement shortfall) and drawable at/after it; a
  non-pension asset ignores access age; an explicit `minAccessAge` overrides the
  57 default; PENSION + null ⇒ gated at 57.
- **Schema test:** accepts valid `feePct`/`minAccessAge`, rejects out-of-range and
  (for fee) negative.
- **Integration:** `updatePlanAsset` persists `feePct` and `minAccessAge`.
- **E2E + live:** the fee field round-trips; live pass — set a fee and watch the
  net-worth curve flatten; set retirement < 57 with pension assets and watch the
  shortfall appear, then raise/lower the pension access age and watch it shift.

## Backward compatibility

`feePct` defaults to 0 — no growth change for existing plans. `minAccessAge` adds
a column with no backfill; the engine's `null → 57` fallback for PENSION wrappers
**does** change existing plans that draw a pension before 57 (they gain a
shortfall in those years) — an intentional correctness fix, accepted in the
brainstorm. Non-pension assets and pensions only ever drawn at/after 57 are
unaffected.

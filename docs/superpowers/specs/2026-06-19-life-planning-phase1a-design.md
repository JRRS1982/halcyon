# Life Planning — Phase 1a: Persist + Render (walking skeleton) — Design

**Date:** 2026-06-19
**Status:** In design (brainstorm) — pending spec review, then implementation plan
**Parent spec:** [`2026-06-14-life-planning-forecast-design.md`](./2026-06-14-life-planning-forecast-design.md) (vision, data model §8, decisions §10)
**Builds on:** Phase 0 projection engine (`src/lib/plan/`, merged in PR #58)
**Related:** [ADR-002 (Security/RLS)](../../ADRs/ADR-002-SecurityArchitecture.md), [ADR-003 (Migrations)](../../ADRs/ADR-003-DBMigrations.md), [Data Models](../../DataModels/DataModels.md)

## 1. Goal

The thinnest **end-to-end thread** that makes the plan real and visible: persist a plan, seed it from the
user's existing data, run the Phase 0 engine, and render the net-worth chart + verdict. Proves the seams
(DB → pure engine → chart) before any editing UI is built.

> Phase 1 was split (it bundled foundation + render + a whole editing layer). **This is Phase 1a:
> foundation + seed + read-only render.** Editing (assumptions form, per-asset/liability editors, the
> `planVisible` toggle) is **Phase 1b**, specced separately.

## 2. Scope

### In scope
- **Prisma models + migration + RLS** for `Plan` and children (parent spec §8), plus
  `UserSettings.planVisible Boolean @default(true)`.
- **Seeding** (`src/lib/plan/seed.ts`): build plan rows from the user's latest Balance period
  (`BalanceItem` → `PlanAsset`/`PlanLiability`) and latest Budget period (`FinancialItem` →
  `PlanIncome`/`PlanExpense`).
- **DB → engine mapping** (`src/lib/plan/toPlanInput.ts`): turn a persisted `Plan` (+ children) into the
  engine's `PlanInput`, and a **today's-money** transform of the projection for display.
- **Create flow**: empty state → capture **date of birth + retirement age** → `createPlan` (defaults +
  seed).
- **`/plan` route** (read-only): server page runs the engine, renders the **net-worth stacked chart** +
  **verdict banner**.
- **Nav**: a `Plan` link, always visible for signed-in users (the `planVisible` *toggle* is 1b; the
  column exists now, defaulting `true`).
- **Tests**: integration (`*.int.test.ts`, real `halcyon_test`) for create/seed; unit tests for the
  mapping + today's-money transform.

### Out of scope (Phase 1b or later)
- Editing assumptions, assets, liabilities, incomes, expenses (1b).
- The `planVisible` Settings toggle UI (1b; column added now).
- Adding/removing line items, the Gantt, the cashflow/liquid-assets charts, the view switcher,
  sliders, real UK tax, inflation feed, scenarios (Phase 2+).

### Known limitation (accepted)
Until 1b, seeded assets have `wrapper: OTHER` (user-set, no guessing — parent §6). So the stacked chart is
effectively one asset colour and tax on withdrawals is understated (`OTHER` is treated as tax-free).
The projection is **directionally correct**, not yet tuned. This is the explicit cost of shipping the
skeleton first.

## 3. Data model

Use the `Plan` + `PlanAsset`/`PlanLiability`/`PlanIncome`/`PlanExpense`/`PlanEvent` models and enums
exactly as in **parent spec §8** (uuid ids, `userId` scoping as the primary boundary **plus** an RLS
policy per ADR-002, `Decimal` money, `deletedAt`, `@@index([planId])`). One migration, authored **in the
container** (`make migrate-create name=add_plan_models`), applied with `make migrate-deploy`.

Addition for this slice:
```prisma
model UserSettings {
  // ...existing...
  planVisible Boolean @default(true)   // nav visibility; toggle UI is Phase 1b
}
```

`User` gains `plans Plan[]`. v1 surfaces a single plan (`Plan.isPrimary = true`).

## 4. Seeding (`src/lib/plan/seed.ts`)

Pure functions that map already-fetched DB rows to plan-child create-inputs (no Prisma inside — the
action fetches, calls these, then writes; keeps them unit-testable). "Latest period" = the most recent
non-deleted `FinancialPeriod` (`granularity: MONTH`) by `startDate`.

- **Assets** — `BalanceItem` where `type = ASSET` →
  `{ label, wrapper: "OTHER", openingValue: Number(value), expectedReturnPct: null, annualContribution: 0,
  drawdownPriority: byCategory, sourceBalanceItemId: id }`.
  `byCategory`: CURRENT→0, MEDIUM_TERM→1, LONG_TERM→2, OTHER→3, PROPERTY→9 (sane drawdown order; user
  refines in 1b).
- **Liabilities** — `BalanceItem` where `type = LIABILITY` →
  `{ label, openingBalance: Number(value), interestPct: 0, monthlyRepayment: 0 }` (rates unknown on a
  balance snapshot; user sets them in 1b — until then a liability just sits, neither accruing nor repaying).
- **Incomes** — `FinancialItem` where `type = INCOME` →
  `{ label, kind: fromIncomeCategory, annualAmount: Number(budget) * 12, taxable: true,
  growth: { kind: "INFLATION" }, endAge: kind==="SALARY" ? retirementAge : null }`.
  `fromIncomeCategory`: SALARY→SALARY, PENSIONS→DB_PENSION, SIDE_INCOME→SELF_EMPLOYMENT, INVESTMENTS→OTHER,
  OTHER→OTHER (null bucket → OTHER).
- **Expenses** — `FinancialItem` where `type = EXPENSE` →
  `{ label, category: item.category ?? null, annualAmount: Number(budget) * 12, inflationLinked: true }`.

Source = the **budget** figure (parent §6: budget by default; the averaged-actuals option is later). If
the latest period has no items of a kind, that collection seeds empty.

## 5. DB → engine mapping (`src/lib/plan/toPlanInput.ts`)

Pure, testable; takes an `asOfYear` (the app passes the real current year — engine stays `Date`-free).

```ts
toPlanInput(plan: PlanWithChildren, asOfYear: number): PlanInput
```
- `currentAge = asOfYear − dateOfBirth.getFullYear()`; `startYear = asOfYear`.
- Maps Decimal columns → `number`; nullable `expectedReturnPct` stays undefined (engine falls back to
  `defaultReturnPct`); `taxRatePct = blendedTaxRatePct`; `statePension` only if both age+amount set.
- Children → engine input shapes (`AssetInput`, etc.).

**Today's-money transform** for display:
```ts
toTodaysMoney(projection: PlanProjection, inflationPct: number, currentAge: number): PlanProjection
```
Divides every money field in each `YearProjection` (and `verdict.peakNetWorth.value`) by
`(1 + inflationPct/100) ** (age − currentAge)`. Engine output stays nominal; the page deflates for the
chart/banner.

## 6. Create flow + route

- **`src/app/plan/page.tsx`** (server): get user (redirect to `/sign-in?next=/plan` if none); load the
  primary `Plan` with all children in one `include`. If none → render the empty state.
- **Empty state**: a small form (DOB + retirement age) posting to `createPlan`.
- **`createPlan(dob, retirementAge)`** server action: fetch latest balance + budget periods, build rows
  via `seed.ts`, create the `Plan` (defaults: `planToAge 95, inflationPct 2.5, defaultReturnPct 5,
  blendedTaxRatePct 20, statePensionAge 67, statePensionAnnual 11500, isPrimary true`) and children in
  one `prisma.$transaction`; `revalidatePath("/plan")`.
- **With a plan**: page computes `asOfYear = new Date().getFullYear()` (app boundary), runs
  `project(toPlanInput(plan, asOfYear))`, applies `toTodaysMoney`, serialises, passes to `PlanView`.

## 7. Components

- **`PlanView.tsx`** (client): lays out the verdict banner + chart from props (mirrors `DashboardView`).
- **`VerdictBanner.tsx`**: feasible? · first-shortfall age · peak net worth (age + today's-money value) ·
  earliest sustainable retirement age. Green/positive vs red/negative theme colours.
- **`NetWorthChart.tsx`** (client, `"use client"`): Recharts `ComposedChart` copying
  `dashboard/CashFlowChart.tsx`. **Stacked bars** (`stackId`) per wrapper — assets positive, liabilities
  as **negative** values below the £0 `ReferenceLine`; a **net-worth `Line`** overlaid; x-axis = age.
  Wrapper→colour from a small `WRAPPER_COLOURS` map (new constant). Default grouping = by wrapper
  (aggregate the per-asset `assets[]` to wrapper totals).
- **Nav**: add `{ href: "/plan", label: "Plan" }` to `SIGNED_IN_ITEMS` in `NavBar`.

## 8. Architecture / files

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (+ migration) | Plan models + `planVisible` |
| `src/lib/plan/seed.ts` (+ `.test.ts`) | DB rows → child create-inputs (pure) |
| `src/lib/plan/toPlanInput.ts` (+ `.test.ts`) | DB Plan → engine `PlanInput`; today's-money transform (pure) |
| `src/app/plan/page.tsx` | server: load/seed-or-render |
| `src/app/plan/actions.ts` (+ `.int.test.ts`) | `createPlan` (transactional seed) |
| `src/app/plan/PlanView.tsx` | client layout |
| `src/app/plan/NetWorthChart.tsx` | stacked bars + net-worth line |
| `src/app/plan/VerdictBanner.tsx` | headline verdict |
| `src/components/ui/NavBar/index.tsx` | add Plan link |

The Phase 0 engine (`src/lib/plan/{project,types,...}`) is **not modified**.

## 9. Testing

- **Unit** (`src/lib/plan/seed.test.ts`, `toPlanInput.test.ts`): seeding maps each BalanceItem/FinancialItem
  correctly (wrapper OTHER, salary endAge = retirementAge, budget×12, category passthrough); mapping
  computes currentAge/startYear, Decimal→number, statePension presence; today's-money deflation is exact.
- **Integration** (`src/app/plan/actions.int.test.ts`, real `halcyon_test`): `createPlan` seeds from a
  user's balance+budget, persists Plan+children, is `userId`-scoped (cross-user isolation), idempotent
  enough (one primary plan), transactional. Mirrors the repo's existing `*.int.test.ts` convention.
- New model needs both the `userId` Prisma filter **and** an RLS policy (ADR-002).

## 10. Success criteria

A signed-in user with existing Balance + Budget data visits `/plan`, enters DOB + retirement age, and
sees their net-worth projected to age `planToAge` as a stacked bar chart (in today's money) with a verdict
("on track to retire at N" / "runs short at N"). All green: `pnpm verify` + integration tests.

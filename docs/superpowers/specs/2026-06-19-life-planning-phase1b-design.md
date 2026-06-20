# Life Planning — Phase 1b: Editing layer — Design

**Date:** 2026-06-19
**Status:** In design (brainstorm) — pending spec review, then implementation plan
**Parent specs:** [`2026-06-14-life-planning-forecast-design.md`](./2026-06-14-life-planning-forecast-design.md) (vision, data model §8), [`2026-06-19-life-planning-phase1a-design.md`](./2026-06-19-life-planning-phase1a-design.md) (the read-only `/plan` this extends)
**Builds on:** Phase 1a (merged PR #59) — Prisma Plan models, `createPlan`/`getPrimaryPlan`, `toPlanInput`/`toTodaysMoney`, the read-only `/plan` net-worth chart + verdict.

## 1. Goal

Make the plan **tunable**. Phase 1a renders a read-only projection seeded from the user's data with every asset `wrapper: OTHER`. This slice adds editing of **global assumptions** and the key fields of seeded **assets** and **liabilities**, so the user sets real wrappers (tax tunes up, chart gets its colours) and adjusts the figures — and adds a Settings toggle to hide the Plan nav link.

## 2. Scope

### In scope
- **Inline editing on `/plan`:** an editable **assumptions panel** + **assets table** + **liabilities table** (the existing budget/balance spreadsheet idiom). Save-on-change → server action → `revalidatePath("/plan")` re-runs the engine server-side; chart + verdict refresh.
- **Server actions** (`src/app/plan/actions.ts`): `updatePlanAssumptions`, `updatePlanAsset`, `updatePlanLiability` — zod-validated, ownership-checked.
- **`planVisible` toggle:** `togglePlanVisible` action + `isPlanVisible(userId)` + a Settings toggle; `NavBar` gates the Plan link on it. **Nav-only** (the `/plan` route stays reachable by URL — declutter, not a security gate).

### Out of scope (later phases)
- Editing **income/expense** streams; **add/remove** of any line (assets, liabilities, incomes, expenses, events) — Phase 2 (the interactive Gantt).
- **Real-time client-side recompute** (sliders) — Phase 3. Here, every edit is a server round-trip + revalidate.
- Multiple plans / scenarios, real UK tax, inflation feed — later.

## 3. Editing model

Mirrors `src/app/balance/BalanceSheet.tsx`: editable cells/inputs that commit on change inside a `useTransition`, calling a server action; on success the action `revalidatePath("/plan")`, so the server re-runs `project(toPlanInput(...))` and the chart/verdict re-render with fresh values. No optimistic local recompute (that's Phase 3). A pending indicator (disabled/dimmed) during the transition; errors surfaced inline (mirror the balance sheet's `setError`).

**Editable fields:**
- **Assumptions** (`AssumptionsPanel`): `dateOfBirth`, `retirementAge`, `planToAge`, `inflationPct`, `defaultReturnPct`, `blendedTaxRatePct`, `statePensionAge`, `statePensionAnnual`.
- **Asset row** (`AssetsTable`): `label`, `wrapper` (select over the 7 `PlanAssetWrapper` values), `openingValue`, `expectedReturnPct` (nullable — empty ⇒ inherits `defaultReturnPct`), `annualContribution`, `drawdownPriority`.
- **Liability row** (`LiabilitiesTable`): `label`, `openingBalance`, `interestPct`, `monthlyRepayment`, `endAge` (nullable).

`contributionEndAge` is not surfaced in 1b (stays null ⇒ engine defaults it to `retirementAge`).

## 4. Server actions (`src/app/plan/actions.ts`)

Each enforces auth (`requireUserId`, already in the file) and **ownership** before writing. New zod schemas live in `src/lib/plan/schemas.ts`.

- **`updatePlanAssumptions(input)`** — `input`: `{ planId, dateOfBirth, retirementAge, planToAge, inflationPct, defaultReturnPct, blendedTaxRatePct, statePensionAge, statePensionAnnual }`. Ownership: `prisma.plan.updateMany({ where: { id: planId, userId, deletedAt: null }, data: {...} })` (scoping the write by `userId` so a foreign `planId` updates zero rows); throw if `count === 0`.
- **`updatePlanAsset(input)`** — `input`: `{ assetId, label, wrapper, openingValue, expectedReturnPct, annualContribution, drawdownPriority }`. Ownership via nested relation filter: `prisma.planAsset.updateMany({ where: { id: assetId, deletedAt: null, plan: { userId, deletedAt: null } }, data: {...} })`; throw if `count === 0`.
- **`updatePlanLiability(input)`** — `input`: `{ liabilityId, label, openingBalance, interestPct, monthlyRepayment, endAge }`. Same nested-relation ownership pattern on `planLiability`.

All three `revalidatePath("/plan")` on success.

**Validation bounds (zod):** `retirementAge` 40–90; `planToAge` 50–120; `statePensionAge` 50–80 (nullable); pct fields — `inflationPct` 0–20, `defaultReturnPct`/`expectedReturnPct`/`interestPct` −20–30 (returns may be negative; `expectedReturnPct` nullable), `blendedTaxRatePct` 0–60; amounts (`openingValue`, `openingBalance`, `annualContribution`, `monthlyRepayment`, `statePensionAnnual`) ≥ 0; `drawdownPriority` int ≥ 0; `endAge` 40–120 nullable; `dateOfBirth` `YYYY-MM-DD`; `wrapper` ∈ the enum.

## 5. `planVisible` toggle

- **`isPlanVisible(userId): Promise<boolean>`** in `src/lib/settings/server.ts` — mirrors `isTransactionsEnabled`, but **defaults `true`** (`row?.planVisible ?? true`).
- **`togglePlanVisible(enabled: boolean)`** in `src/app/settings/actions.ts` — mirrors `toggleTransactions` (upsert `UserSettings.planVisible`); `revalidatePath("/", "layout")` so the nav updates.
- **Settings UI:** add a Plan-visibility toggle alongside the transactions toggle (in `SettingsForm.tsx`).
- **Nav:** `layout.tsx` computes `planVisible = user ? await isPlanVisible(user.id) : false` and passes it to `NavBar`; `NavBar` gains a `planVisible` prop and renders the Plan link only when true (Phase 1a added the link unconditionally — change it to gated, keeping order Dashboard, Budget, Balance, Plan, [Transactions], Settings).

## 6. Data flow

`page.tsx` already runs the engine for the chart. It additionally serializes the **raw editable plan data** (assumptions scalar fields; `assets[]` and `liabilities[]` with `Decimal→number`, `dateOfBirth→YYYY-MM-DD` string) into a `SerializedPlan` shape and passes it to `PlanView` next to the projection. `PlanView` renders the chart/verdict (from the projection) plus the three editors (from the serialized plan). Editors call the actions; revalidate reloads the page data.

## 7. Architecture / files

| File | Responsibility |
|---|---|
| `src/lib/plan/schemas.ts` (+ `.test.ts`) | zod schemas for the three update actions (bounds) |
| `src/app/plan/actions.ts` | + `updatePlanAssumptions`, `updatePlanAsset`, `updatePlanLiability` |
| `src/app/plan/AssumptionsPanel.tsx` | editable assumptions form (client) |
| `src/app/plan/AssetsTable.tsx` | inline-editable asset rows (client) |
| `src/app/plan/LiabilitiesTable.tsx` | inline-editable liability rows (client) |
| `src/app/plan/PlanView.tsx` | compose chart + verdict + the three editors |
| `src/app/plan/page.tsx` | serialize raw plan data + pass to `PlanView` |
| `src/lib/settings/server.ts` | + `isPlanVisible` |
| `src/app/settings/actions.ts` | + `togglePlanVisible` |
| `src/app/settings/SettingsForm.tsx` | + Plan-visibility toggle |
| `src/app/layout.tsx` | read `isPlanVisible` → `NavBar` |
| `src/components/ui/NavBar/index.tsx` | gate Plan link on `planVisible` |

The engine (`src/lib/plan/{project,types,seed,toPlanInput,chartData,...}`) is **not modified**.

## 8. Testing

- **Integration** (`src/__tests__/plan/*.int.test.ts`, real `halcyon_test`): each update action persists the change and is **ownership-scoped** — a second user's `planId`/`assetId`/`liabilityId` updates nothing (count 0 → throws), no cross-user write. Plus `togglePlanVisible` upserts the flag.
- **Unit** (`src/lib/plan/schemas.test.ts`): zod bounds accept valid input and reject out-of-range (e.g. `retirementAge` 39, negative amount, unknown wrapper, nullable `expectedReturnPct`).
- Editor components (React/forms) have no unit tests — verified by `pnpm typecheck` + `pnpm check` + `pnpm build` (consistent with the chart components).
- Ownership scoping satisfies ADR-002 (app-level `userId` boundary) on top of the RLS already added in 1a.

## 9. Success criteria

A user opens `/plan`, sets each asset's wrapper (e.g. SIPP→PENSION, ISA→ISA) and adjusts returns/contributions, tweaks assumptions (retirement age, inflation) — and the net-worth chart + verdict update on each save, now correctly coloured by wrapper and with tax applied to pension/GIA drawdown. A Settings toggle hides/shows the Plan nav link. All green: `pnpm verify` + integration tests.

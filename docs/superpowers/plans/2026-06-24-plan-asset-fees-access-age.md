# Plan Asset Fees + Pension Access Age Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two per-asset settings to the `/plan` forecast — an annual fee/charge % (subtracted from the asset's return) and a pension minimum access age (gates drawdown before that age).

**Architecture:** Two new `PlanAsset` columns. The engine (pure) subtracts `feePct` from each asset's effective return at the single `grow()` line (alongside the band's `returnDeltaPct`), and `fundDeficit` gains the year's `age` so it can skip an asset whose access age hasn't been reached. The pension default of 57 lives in an engine/UI fallback (`null → 57` for the PENSION wrapper), so no data backfill is needed. The fields edit through the existing asset drawer.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Prisma 7 (Postgres/Supabase), zod, styled-components, Jest + RTL (unit, jsdom), Playwright (e2e), Biome.

## Global Constraints

- **Fees are opt-in:** `feePct` DB default `0` ⇒ no growth change for existing plans.
- **Pension access default 57 via fallback, not DB default:** `minAccessAge` is nullable with no backfill; the engine treats a PENSION-wrapper asset with `null` as `57`. This DOES retroactively lock existing pensions at 57 (an intentional correctness change). Non-PENSION assets with `null` are never gated.
- **Fee subtracts from the effective return; access age gates only withdrawals** (contributions into a locked pension stay allowed — do not touch the contribution loop / `contributionTargetId`).
- **Engine stays pure/deterministic;** band, deflation, charts, verdict, timeline are untouched.
- **`pnpm verify` (`typecheck && biome ci && test`) is the finish gate.** `biome ci` is stricter than lint — run `pnpm format` if it flags formatting. **Implementers must run `pnpm check`, not just `pnpm typecheck`** (recurring formatting drift).
- **Biome bans the non-null assertion `!`** — use guards / `?.` / `??`.
- **Migrations container-only to author** (`make migrate-create name=<verb_table>`); `halcyon_test` touched only with explicitly env-pinned `DATABASE_URL`/`DIRECT_URL` — never bare `pnpm prisma migrate` on the host.
- **Editing→chart convention:** a mutating server action is followed by `router.refresh()` in the client editor.
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Migration — `feePct` + `minAccessAge` columns

**Files:**
- Modify: `prisma/schema.prisma` (`PlanAsset` model)
- Create: `prisma/migrations/<timestamp>_add_asset_fees_access_age/migration.sql` (generated)
- Possibly modify: `src/lib/plan/toPlanInput.test.ts` (a `PlanWithChildren`-typed fixture's asset may need the new fields once the Prisma type regenerates — see Step 4)

**Interfaces:**
- Produces: `PlanAsset.feePct` (`Decimal(5,2)`, default 0) and `PlanAsset.minAccessAge` (`Int?`) on the generated `@prisma/client` types.

- [ ] **Step 1: Add the columns to the schema**

In `prisma/schema.prisma`, inside `model PlanAsset`, add `feePct` immediately after `expectedReturnPct`, and `minAccessAge` immediately after `contributionEndAge`:

```prisma
  expectedReturnPct   Decimal?         @db.Decimal(5, 2)
  feePct              Decimal          @default(0) @db.Decimal(5, 2)
  annualContribution  Decimal          @default(0) @db.Decimal(12, 2)
  contributionEndAge  Int?
  minAccessAge        Int?
  drawdownPriority    Int              @default(0)
```

- [ ] **Step 2: Author the migration in the container**

Run: `make migrate-create name=add_asset_fees_access_age`
Expected: a new `prisma/migrations/<timestamp>_add_asset_fees_access_age/migration.sql` is created and applied to the local `halcyon` DB; its SQL contains `ADD COLUMN "feePct" DECIMAL(5,2) NOT NULL DEFAULT 0` and `ADD COLUMN "minAccessAge" INTEGER`.

- [ ] **Step 3: Apply the migration to the integration-test DB**

Run (env-pinned, safe — does not touch prod):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
npx prisma migrate deploy
```

Expected: reports applying `add_asset_fees_access_age` (idempotent if already applied).

- [ ] **Step 4: Regenerate the client and fix any fixture the type now requires**

Run: `pnpm prisma generate && pnpm typecheck`

If `pnpm typecheck` fails in `src/lib/plan/toPlanInput.test.ts` because a `PlanWithChildren`-typed asset fixture is missing the new non-null `feePct` (and/or `minAccessAge`), add them to that fixture — `feePct: d(0)` (matching the existing `d(...)` Decimal helper in that file) and `minAccessAge: null`. Do not change anything else. Re-run `pnpm typecheck` until clean.

- [ ] **Step 5: Verify formatting + tests**

Run: `pnpm check && pnpm test`
Expected: PASS (282 tests; clean formatting).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/plan/toPlanInput.test.ts
git commit -m "feat(plan): add feePct + minAccessAge columns to PlanAsset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(If `toPlanInput.test.ts` did not need changing, omit it from the `git add`.)

---

### Task 2: Engine — fees in growth + access-age drawdown gate

**Files:**
- Modify: `src/lib/plan/types.ts` (`AssetInput`)
- Modify: `src/lib/plan/assets.ts` (`fundDeficit` gains `age`; access-limit skip)
- Modify: `src/lib/plan/project.ts` (fee in `grow()`; pass `age` to `fundDeficit`)
- Modify: `src/lib/plan/toPlanInput.ts` (populate `feePct`, `minAccessAge`)
- Test: `src/lib/plan/assets.test.ts` (access-age), `src/lib/plan/project.test.ts` (fee)

**Interfaces:**
- Consumes: `AssetInput`, `fundDeficit`, `grow`, `projectYears` (existing).
- Produces:
  - `AssetInput.feePct?: number` and `AssetInput.minAccessAge?: number`.
  - `fundDeficit(assets, balances, need, ratePct, age)` — new trailing `age: number` parameter.
  - Drawdown skips an asset when `accessLimit(a) !== null && age < accessLimit(a)`, where `accessLimit(a) = a.minAccessAge ?? (a.wrapper === "PENSION" ? 57 : null)`.

- [ ] **Step 1: Add the AssetInput fields**

In `src/lib/plan/types.ts`, in `interface AssetInput`, add after `expectedReturnPct`:

```ts
  expectedReturnPct?: number; // undefined ⇒ PlanInput.defaultReturnPct
  feePct?: number; // annual charge subtracted from the effective return; default 0
```

and after `contributionEndAge`:

```ts
  contributionEndAge?: number; // default = PlanInput.retirementAge
  minAccessAge?: number; // earliest drawdown age; PENSION defaults to 57 when undefined
```

- [ ] **Step 2: Write the failing engine tests**

In `src/lib/plan/project.test.ts`, add inside `describe("project", ...)` (the `base`/`at`/`wrapperTotal` helpers already exist):

```ts
  it("subtracts feePct from the asset's effective return", () => {
    const p = project(
      base({
        planToAge: 40,
        defaultReturnPct: 10,
        assets: [
          {
            id: "a",
            label: "GIA",
            wrapper: "GIA",
            openingValue: 10000,
            feePct: 2,
            drawdownPriority: 1,
          },
        ],
      }),
    );
    // 10% return − 2% fee = 8% growth on 10000 ⇒ 10800
    expect(wrapperTotal(at(p, 0), "GIA")).toBeCloseTo(10800, 0);
  });
```

In `src/lib/plan/assets.test.ts`, add (build `AssetInput`s inline; this file already imports `fundDeficit`):

```ts
  it("skips a pension before its access age, funds it at/after", () => {
    const pension = {
      id: "p",
      label: "SIPP",
      wrapper: "PENSION" as const,
      openingValue: 100000,
      drawdownPriority: 1,
    };
    const before = fundDeficit([pension], { p: 100000 }, 10000, 0, 55);
    expect(before.shortfall).toBe(true);
    expect(before.totalWithdrawn).toBe(0);

    const after = fundDeficit([pension], { p: 100000 }, 10000, 0, 57);
    expect(after.shortfall).toBe(false);
    expect(after.totalWithdrawn).toBeGreaterThan(0);
  });

  it("does not gate a non-pension asset and honours an explicit minAccessAge", () => {
    const isa = {
      id: "i",
      label: "ISA",
      wrapper: "ISA" as const,
      openingValue: 100000,
      drawdownPriority: 1,
    };
    expect(fundDeficit([isa], { i: 100000 }, 10000, 0, 40).shortfall).toBe(false);

    const earlyPension = {
      id: "p",
      label: "SIPP",
      wrapper: "PENSION" as const,
      openingValue: 100000,
      minAccessAge: 50,
      drawdownPriority: 1,
    };
    expect(fundDeficit([earlyPension], { p: 100000 }, 10000, 0, 52).shortfall).toBe(
      false,
    );
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `make test name="feePct"` then `make test name="access age"`
Expected: FAIL — `project` still grows at 10% (returns 11000, not 10800); `fundDeficit` is called with 5 args but its signature takes 4, and there is no access gate (TypeScript error / wrong shortfall).

- [ ] **Step 4: Subtract the fee in the growth line**

In `src/lib/plan/project.ts`, the asset-growth loop becomes:

```ts
    for (const a of runAssets) {
      assetBal[a.id] = grow(
        assetBal[a.id] ?? 0,
        (a.expectedReturnPct ?? input.defaultReturnPct) -
          (a.feePct ?? 0) +
          returnDeltaPct,
      );
    }
```

- [ ] **Step 5: Add the access gate to `fundDeficit`**

In `src/lib/plan/assets.ts`, add the helper near the top (after the `drawable` helper):

```ts
// Earliest age an asset may be drawn. PENSION defaults to 57 when unset; other
// wrappers are unrestricted unless an explicit minAccessAge is given.
const accessLimit = (a: AssetInput): number | null =>
  a.minAccessAge ?? (a.wrapper === "PENSION" ? 57 : null);
```

Change the `fundDeficit` signature to take `age` and filter the drawdown order by access:

```ts
export const fundDeficit = (
  assets: AssetInput[],
  balances: Record<string, number>,
  need: number,
  ratePct: number,
  age: number,
): FundResult => {
```

and the `order` computation:

```ts
  const order = assets
    .filter(drawable)
    .filter((a) => {
      const limit = accessLimit(a);
      return limit === null || age >= limit;
    })
    .sort((a, b) => a.drawdownPriority - b.drawdownPriority);
```

- [ ] **Step 6: Pass `age` at the call site**

In `src/lib/plan/project.ts`, the `fundDeficit` call (in the `cashflow < 0` branch) becomes:

```ts
      const fund = fundDeficit(
        runAssets,
        assetBal,
        -cashflow,
        input.taxRatePct,
        age,
      );
```

- [ ] **Step 7: Populate the fields in `toPlanInput`**

In `src/lib/plan/toPlanInput.ts`, in the `assets.map(...)`, add after `expectedReturnPct`:

```ts
      expectedReturnPct: optNum(a.expectedReturnPct),
      feePct: num(a.feePct),
```

and after `contributionEndAge`:

```ts
      contributionEndAge: a.contributionEndAge ?? undefined,
      minAccessAge: a.minAccessAge ?? undefined,
```

- [ ] **Step 8: Run tests + typecheck**

Run: `make test name="feePct"`, `make test name="access age"`, then `pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 9: Verify formatting + full suite**

Run: `pnpm check && pnpm test`
Expected: PASS (`pnpm format` first if `pnpm check` flags anything).

- [ ] **Step 10: Commit**

```bash
git add src/lib/plan/types.ts src/lib/plan/assets.ts src/lib/plan/project.ts src/lib/plan/toPlanInput.ts src/lib/plan/assets.test.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): asset fees reduce return; pension access age gates drawdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Persist + edit the two fields (schema, action, serialized, page, drawer)

**Files:**
- Modify: `src/lib/plan/schemas.ts` (`updatePlanAssetSchema`)
- Modify: `src/lib/plan/schemas.test.ts` (`validAsset` fixture + a new case)
- Modify: `src/app/plan/serialized.ts` (`SerializedPlanAsset`)
- Modify: `src/app/plan/page.tsx` (serialize both)
- Modify: `src/app/plan/actions.ts` (`updatePlanAsset` data)
- Modify: `src/app/plan/AssetsTable.tsx` (`AssetFields` save payload + two drawer fields)
- Modify: `src/__tests__/plan/updateActions.int.test.ts` (existing `updatePlanAsset` call + assertion)

**Interfaces:**
- Consumes: `SerializedPlanAsset`, `NumberCell`, `updatePlanAsset`, `DrawerSection`, `Field`.
- Produces: `updatePlanAssetSchema` requires `feePct: number (0..5)` and `minAccessAge: number|null (50..75)`; `SerializedPlanAsset` gains `feePct: number` and `minAccessAge: number | null`.

> Schema + action + serialized + page + the drawer form change together: making `feePct` required in the schema forces `AssetFields.save()` (and the existing int-test call) to send it. They are one task so typecheck is green at the boundary.

- [ ] **Step 1: Write the failing schema test**

In `src/lib/plan/schemas.test.ts`, add `feePct: 0` and `minAccessAge: null` to the `validAsset` fixture (after `expectedReturnPct`/before `drawdownPriority` — any position), and add inside `describe("updatePlanAssetSchema")`:

```ts
  it("rejects out-of-range feePct and minAccessAge", () => {
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, feePct: 6 }),
    ).toThrow();
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, feePct: -1 }),
    ).toThrow();
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, minAccessAge: 40 }),
    ).toThrow();
    expect(
      updatePlanAssetSchema.parse({ ...validAsset, minAccessAge: null })
        .minAccessAge,
    ).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="updatePlanAssetSchema"`
Expected: FAIL — `validAsset` lacks the required `feePct`, and the new bounds aren't in the schema yet.

- [ ] **Step 3: Add the fields to the schema**

In `src/lib/plan/schemas.ts`, in `updatePlanAssetSchema`, add after `expectedReturnPct` and after `contributionEndAge` respectively:

```ts
  expectedReturnPct: z.number().min(-20).max(30).nullable(),
  feePct: z.number().min(0).max(5),
  annualContribution: z.number().min(0),
  contributionEndAge: z.number().int().min(0).max(120).nullable(),
  minAccessAge: z.number().int().min(50).max(75).nullable(),
  drawdownPriority: z.number().int().min(0),
```

- [ ] **Step 4: Run the schema test**

Run: `make test name="updatePlanAssetSchema"`
Expected: PASS.

- [ ] **Step 5: Thread through serialized + page**

In `src/app/plan/serialized.ts`, in `SerializedPlanAsset`, add after `expectedReturnPct` and `contributionEndAge`:

```ts
  expectedReturnPct: number | null;
  feePct: number;
  annualContribution: number;
  contributionEndAge: number | null;
  minAccessAge: number | null;
  drawdownPriority: number;
```

In `src/app/plan/page.tsx`, in the `plan.assets.map(...)` serialization, add after `expectedReturnPct` and `contributionEndAge`:

```ts
      expectedReturnPct:
        a.expectedReturnPct === null ? null : Number(a.expectedReturnPct),
      feePct: Number(a.feePct),
      annualContribution: Number(a.annualContribution),
      contributionEndAge: a.contributionEndAge,
      minAccessAge: a.minAccessAge,
      drawdownPriority: a.drawdownPriority,
```

- [ ] **Step 6: Persist in the action**

In `src/app/plan/actions.ts`, in `updatePlanAsset`'s `data`, add after `expectedReturnPct` and `contributionEndAge`:

```ts
      expectedReturnPct: p.expectedReturnPct,
      feePct: p.feePct,
      annualContribution: p.annualContribution,
      contributionEndAge: p.contributionEndAge,
      minAccessAge: p.minAccessAge,
      drawdownPriority: p.drawdownPriority,
```

- [ ] **Step 7: Add the drawer fields + save payload**

In `src/app/plan/AssetsTable.tsx`, in `AssetFields`, add the two fields to the `save` payload (after `expectedReturnPct` and `contributionEndAge`):

```ts
        expectedReturnPct: next.expectedReturnPct,
        feePct: next.feePct,
        annualContribution: next.annualContribution,
        contributionEndAge: next.contributionEndAge,
        minAccessAge: next.minAccessAge,
        drawdownPriority: next.drawdownPriority,
```

Add a **Fees** field inside the existing `Growth` `DrawerSection` (after the "Expected return %" `Field`):

```tsx
        <Field label="Fees / charges %">
          <NumberCell
            value={asset.feePct}
            step="0.1"
            onCommit={(v) => save({ ...asset, feePct: v ?? asset.feePct })}
          />
        </Field>
```

Add a pension-gated **access age** field inside the existing `Drawdown` `DrawerSection` (after the "Draw order" `Field`):

```tsx
        {asset.wrapper === "PENSION" ? (
          <Field label="Earliest access age">
            <NumberCell
              value={asset.minAccessAge ?? 57}
              nullable
              onCommit={(v) => save({ ...asset, minAccessAge: v })}
            />
          </Field>
        ) : null}
```

- [ ] **Step 8: Fix + extend the integration test**

In `src/__tests__/plan/updateActions.int.test.ts`, the existing `updatePlanAsset(...)` call (if present) is now missing the required `feePct`. Add `feePct: 0.5,` and `minAccessAge: 57,` to that call's input, and after the existing assertions add:

```ts
    const asset = defined(
      await prisma.planAsset.findFirst({ where: { plan: { userId: TEST_USER_ID } } }),
      "updated asset",
    );
    expect(Number(asset.feePct)).toBe(0.5);
    expect(asset.minAccessAge).toBe(57);
```

(If the file has no `updatePlanAsset` test, add a minimal one mirroring the `updatePlanAssumptions` test in the same file: create a plan with an asset, call `updatePlanAsset` with a full valid input including `feePct`/`minAccessAge`, then assert the two values persisted. Reuse the file's existing `makePlan`/`defined` helpers.)

- [ ] **Step 9: Run unit + integration + typecheck + format**

Run:
```bash
pnpm typecheck && pnpm check && make test name="updatePlanAssetSchema"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public pnpm test:int -- updateActions
```
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/plan/schemas.ts src/lib/plan/schemas.test.ts src/app/plan/serialized.ts src/app/plan/page.tsx src/app/plan/actions.ts src/app/plan/AssetsTable.tsx src/__tests__/plan/updateActions.int.test.ts
git commit -m "feat(plan): persist + edit asset fees % and pension access age

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: E2E + live verification

**Files:**
- Modify: `e2e/plan.spec.ts`

- [ ] **Step 1: Add an e2e assertion for the fee field**

In `e2e/plan.spec.ts`, mirror the existing asset-drawer editing test: open an asset's drawer, expand/locate the "Fees / charges %" field, set a value (e.g. `0.5`), and assert it round-trips (`toHaveValue("0.5")` after the commit + refresh). Copy the locators and the open-drawer mechanism from the nearest existing asset-drawer test in the file — do not invent new waits.

- [ ] **Step 2: Run the e2e test**

Run: `make test-e2e name="plan"`
Expected: PASS. (Spins up the mock-auth + Next dev server on `:3100` against `halcyon_test`, which now has the migration. If the harness needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome`, use that fallback per the repo docs.)

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): drive the asset fees field on /plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Live pass (controller)**

With the app on `:3210` signed in as demo, on `/plan`:
1. Open an asset, set **Fees / charges %** to e.g. 1.5; confirm the net-worth curve flattens (lower growth) after the refresh.
2. Set the plan's retirement age below 57 (Assumptions) with the demo's pension assets present; confirm a shortfall appears in the pre-57 years.
3. Open the SIPP (PENSION) asset; confirm the **Earliest access age** field shows (defaulting to 57), and that lowering it (e.g. 55) removes/shifts the early shortfall; confirm the field is **absent** for a non-pension asset (e.g. a CASH account).

Document the result for the PR. No commit unless a tweak is needed.

---

## Self-Review

**Spec coverage:**
- §1 data model (`feePct` default 0, `minAccessAge` nullable no-backfill) → Task 1. ✓
- §2 engine — fee subtracted at the `grow()` line → Task 2 Step 4; `fundDeficit` gains `age` + wrapper-driven access skip composing with the PROPERTY `drawable` filter → Task 2 Steps 5-6; contributions not gated (contribution loop untouched) → Task 2 touches only `fundDeficit`/`grow`. ✓
- §2 `toPlanInput` populates both → Task 2 Step 7. ✓
- §3 drawer UI (fee for all wrappers in Growth; access age pension-gated in Drawdown, value `?? 57`) → Task 3 Step 7; schema bounds (fee 0–5, access 50–75 nullable) → Task 3 Step 3. ✓
- §3 serialized/page/action wiring → Task 3 Steps 5-6. ✓
- §5 testing (engine units, schema test, int persist, e2e + live) → Tasks 2,3,4. ✓
- Backward compat (fee default 0 inert; pension null→57 retroactive) → Task 1 (default 0) + Task 2 (fallback). ✓

**Placeholder scan:** No TBD/TODO; every code step shows the code. Task 3 Step 8 and Task 4 Step 1 reference "the existing test/locators" because the exact int-test call and e2e locators depend on current file contents — both point at a concrete neighbouring pattern to copy (the `updatePlanAssumptions` int test; the nearest asset-drawer e2e test), not invented behaviour.

**Type consistency:** `feePct: number` (AssetInput optional; serialized/schema required) and `minAccessAge` (`number?` in AssetInput, `number | null` in serialized/schema) are used consistently. `fundDeficit`'s new `age: number` is the 5th positional arg at both the definition (Task 2 Step 5) and the call site (Task 2 Step 6) and the tests (Task 2 Step 2). `accessLimit` is defined once in `assets.ts`. The drawer reads `asset.feePct` / `asset.minAccessAge ?? 57`, matching the serialized type.

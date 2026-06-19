# Life Planning — Phase 1a (Persist + Seed + Render) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/plan` real and visible — persist a plan, seed it from the user's Balance + Budget data, run the Phase 0 engine, and render a read-only net-worth stacked chart + verdict (in today's money).

**Architecture:** Pure mapping modules (`seed`, `toPlanInput`, chart-data) sit between Prisma and the already-built engine (`src/lib/plan/`). A server page runs the engine and hands serialized data to client chart/banner components copied from the dashboard's Recharts pattern. The engine is **not modified**.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (Postgres), Recharts 3, styled-components, Jest (unit + `*.int.test.ts` integration), Biome.

**Spec:** [`../specs/2026-06-19-life-planning-phase1a-design.md`](../specs/2026-06-19-life-planning-phase1a-design.md) and parent [`../specs/2026-06-14-life-planning-forecast-design.md`](../specs/2026-06-14-life-planning-forecast-design.md) §8.

## Global Constraints

- **Node** `>=22.22.3`; **pnpm** `10.24.0`. Money columns are Prisma `Decimal` → convert to `number` at the boundary (`Number(x)`); the engine works in `number`.
- **Migrations are container-only** (CLAUDE.md "local vs prod DB trap"): author with `make migrate-create name=add_plan_models`, never `pnpm prisma migrate` on the host. The local app DB and `halcyon_test` both need the migration applied (`make migrate-deploy`; for the test DB see Task 1).
- **Biome bans non-null assertions (`!`)** — use none; verify with `pnpm check` (`biome ci .`), not just `pnpm lint:fix`. Transient styled-component props use a `$` prefix.
- **Authorization:** every server action enforces auth independently (`requireUserId`) and scopes every query by `userId`; new models get an RLS policy too (ADR-002).
- Unit tests: `pnpm test <path>`. Integration: `pnpm test:int` (pins `halcyon_test`). Full gate: `pnpm verify` (typecheck + check + test).
- Engine import surface: `@/lib/plan` exports `project`, `type PlanInput`, `type PlanProjection`, `type YearProjection`, `type Wrapper`, `type IncomeKind`, `WRAPPERS`.

## File structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (+ migration) | Plan + child models, enums, `UserSettings.planVisible` |
| `src/lib/plan/seed.ts` (+ `.test.ts`) | DB Balance/Budget rows → plan child create-inputs (pure) |
| `src/lib/plan/toPlanInput.ts` (+ `.test.ts`) | persisted Plan → engine `PlanInput`; nominal→today's-money (pure) |
| `src/lib/plan/chartData.ts` (+ `.test.ts`) | `YearProjection[]` → net-worth stacked-bar rows (pure) |
| `src/app/plan/actions.ts` (+ `.int.test.ts`) | `createPlan` (transactional seed) |
| `src/app/plan/page.tsx` | server: load plan → run engine → render, or empty state |
| `src/app/plan/PlanView.tsx` | client layout |
| `src/app/plan/VerdictBanner.tsx` | headline verdict |
| `src/app/plan/NetWorthChart.tsx` | Recharts stacked bars + net-worth line |
| `src/app/plan/CreatePlanForm.tsx` | empty-state DOB + retirement-age form |
| `src/app/plan/colours.ts` | `WRAPPER_COLOURS` map |
| `src/components/ui/NavBar/index.tsx` | add the Plan link |

---

## Task 1: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_plan_models/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `Plan`, `PlanAsset`, `PlanLiability`, `PlanIncome`, `PlanExpense`, `PlanEvent`; enums `PlanAssetWrapper`, `PlanIncomeKind`, `PlanEventDirection`, `GrowthKind`; `UserSettings.planVisible`. The generated Prisma client types are consumed by every later task.

- [ ] **Step 1: Add models + enums to `prisma/schema.prisma`** (append; add `plans Plan[]` to `model User` and `planVisible Boolean @default(true)` to `model UserSettings`). Reuse the existing `ExpenseCategory` enum for `PlanExpense.category`.

```prisma
enum PlanAssetWrapper { PENSION ISA GIA CASH PROPERTY DB_PENSION OTHER }
enum PlanIncomeKind   { SALARY SELF_EMPLOYMENT STATE_PENSION DB_PENSION RENTAL OTHER }
enum PlanEventDirection { INFLOW OUTFLOW }
enum GrowthKind { INFLATION FIXED NONE }

model Plan {
  id                 String   @id @default(uuid()) @db.Uuid
  userId             String   @db.Uuid
  name               String   @default("My plan")
  dateOfBirth        DateTime @db.Date
  retirementAge      Int
  planToAge          Int      @default(95)
  inflationPct       Decimal  @default(2.5) @db.Decimal(5, 2)
  defaultReturnPct   Decimal  @default(5) @db.Decimal(5, 2)
  blendedTaxRatePct  Decimal  @default(20) @db.Decimal(5, 2)
  statePensionAge    Int?
  statePensionAnnual Decimal? @db.Decimal(12, 2)
  isPrimary          Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  deletedAt          DateTime?

  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  assets      PlanAsset[]
  liabilities PlanLiability[]
  incomes     PlanIncome[]
  expenses    PlanExpense[]
  events      PlanEvent[]

  @@index([userId])
}

model PlanAsset {
  id                  String           @id @default(uuid()) @db.Uuid
  planId              String           @db.Uuid
  label               String
  wrapper             PlanAssetWrapper @default(OTHER)
  openingValue        Decimal          @default(0) @db.Decimal(14, 2)
  expectedReturnPct   Decimal?         @db.Decimal(5, 2)
  annualContribution  Decimal          @default(0) @db.Decimal(12, 2)
  contributionEndAge  Int?
  drawdownPriority    Int              @default(0)
  sourceBalanceItemId String?          @db.Uuid
  sortOrder           Int              @default(0)
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  deletedAt           DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanLiability {
  id              String   @id @default(uuid()) @db.Uuid
  planId          String   @db.Uuid
  label           String
  openingBalance  Decimal  @default(0) @db.Decimal(14, 2)
  interestPct     Decimal  @default(0) @db.Decimal(5, 2)
  monthlyRepayment Decimal @default(0) @db.Decimal(12, 2)
  endAge          Int?
  linkedAssetId   String?  @db.Uuid
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanIncome {
  id           String         @id @default(uuid()) @db.Uuid
  planId       String         @db.Uuid
  label        String
  kind         PlanIncomeKind
  annualAmount Decimal        @default(0) @db.Decimal(12, 2)
  startAge     Int?
  endAge       Int?
  growthKind   GrowthKind     @default(INFLATION)
  growthPct    Decimal?       @db.Decimal(5, 2)
  taxable      Boolean        @default(true)
  sortOrder    Int            @default(0)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  deletedAt    DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanExpense {
  id              String           @id @default(uuid()) @db.Uuid
  planId          String           @db.Uuid
  label           String
  category        ExpenseCategory?
  annualAmount    Decimal          @default(0) @db.Decimal(12, 2)
  startAge        Int?
  endAge          Int?
  inflationLinked Boolean          @default(true)
  sourceCategoryId String?         @db.Uuid
  sortOrder       Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  deletedAt       DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanEvent {
  id        String             @id @default(uuid()) @db.Uuid
  planId    String             @db.Uuid
  label     String
  age       Int
  direction PlanEventDirection
  amount    Decimal            @default(0) @db.Decimal(14, 2)
  sortOrder Int                @default(0)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  deletedAt DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}
```

- [ ] **Step 2: Author the migration in the container**

Run: `make migrate-create name=add_plan_models`
Expected: a new `prisma/migrations/<ts>_add_plan_models/migration.sql` is created and applied to the local Docker DB; `prisma generate` runs. If Docker isn't running, start it (`make up`) first. **Do not** run `pnpm prisma migrate` on the host.

- [ ] **Step 3: Add RLS policies** to the generated `migration.sql` (append, before committing — mirrors the pattern in `prisma/migrations/20260522130000_supabase_auth_integration/migration.sql`). For each of the 6 tables, enable RLS and add an owner policy. `Plan` keys on `userId`; children key through their plan:

```sql
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_owner" ON "Plan" USING (auth.uid() = "userId");

ALTER TABLE "PlanAsset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planasset_owner" ON "PlanAsset" USING (
  EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanAsset"."planId" AND p."userId" = auth.uid())
);
-- repeat the same EXISTS policy for PlanLiability, PlanIncome, PlanExpense, PlanEvent
```

After editing the SQL, re-apply: `make migrate-deploy`.

- [ ] **Step 4: Apply the migration to the test DB** so integration tests (Task 5) can run.

Run: `pnpm test:int` is configured for `halcyon_test`; apply the schema first with the repo's integration setup. If there's no auto-migrate in `jest.integration.config.ts`, apply manually against the test DB (container): `make db-shell` is for the app DB — for `halcyon_test` run `DATABASE_URL=postgresql://test:test@localhost:5432/halcyon_test pnpm prisma migrate deploy` **inside the container shell** (`make shell`), never on the host. Verify the `Plan` table exists before Task 5.

- [ ] **Step 5: Verify typecheck sees the new client**

Run: `pnpm typecheck`
Expected: PASS (Prisma client regenerated with `Plan`, `PlanAsset`, … types).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(plan): add Plan + child models, enums, planVisible (migration + RLS)"
```

---

## Task 2: Seeding (`seed.ts`)

**Files:**
- Create: `src/lib/plan/seed.ts`
- Test: `src/lib/plan/seed.test.ts`

**Interfaces:**
- Consumes: Prisma enum value types (`BalanceItemType`, `BalanceItemCategory`, `ItemType`, `IncomeCategory`, `ExpenseCategory`, `PlanAssetWrapper`, `PlanIncomeKind`) from `@prisma/client`.
- Produces: `seedPlanChildren(balanceItems, financialItems, retirementAge) → SeededChildren` and the `SeedBalanceItem`, `SeedFinancialItem`, `SeededChildren` types. Consumed by `createPlan` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/seed.test.ts
import { seedPlanChildren } from "./seed";

describe("seedPlanChildren", () => {
  it("maps balance assets to OTHER-wrapper PlanAssets with category-based drawdown order", () => {
    const r = seedPlanChildren(
      [
        { id: "b1", type: "ASSET", category: "CURRENT", label: "Cash", value: 5000 },
        { id: "b2", type: "ASSET", category: "LONG_TERM", label: "SIPP", value: 100000 },
      ],
      [],
      65,
    );
    expect(r.assets).toEqual([
      { label: "Cash", wrapper: "OTHER", openingValue: 5000, annualContribution: 0, drawdownPriority: 0, sourceBalanceItemId: "b1" },
      { label: "SIPP", wrapper: "OTHER", openingValue: 100000, annualContribution: 0, drawdownPriority: 2, sourceBalanceItemId: "b2" },
    ]);
  });

  it("maps balance liabilities to PlanLiabilities (rates default 0)", () => {
    const r = seedPlanChildren(
      [{ id: "b3", type: "LIABILITY", category: "LONG_TERM", label: "Mortgage", value: 120000 }],
      [],
      65,
    );
    expect(r.liabilities).toEqual([
      { label: "Mortgage", openingBalance: 120000, interestPct: 0, monthlyRepayment: 0 },
    ]);
  });

  it("maps income items by kind, salary ends at retirement, amount = budget x 12", () => {
    const r = seedPlanChildren(
      [],
      [
        { type: "INCOME", incomeCategory: "SALARY", category: null, label: "Salary", budget: 4000, sourceCategoryId: "c1" },
        { type: "INCOME", incomeCategory: "PENSIONS", category: null, label: "DB pension", budget: 1000, sourceCategoryId: "c2" },
      ],
      65,
    );
    expect(r.incomes).toEqual([
      { label: "Salary", kind: "SALARY", annualAmount: 48000, taxable: true, growthKind: "INFLATION", endAge: 65 },
      { label: "DB pension", kind: "DB_PENSION", annualAmount: 12000, taxable: true, growthKind: "INFLATION", endAge: null },
    ]);
  });

  it("maps expense items, carrying the category bucket, amount = budget x 12", () => {
    const r = seedPlanChildren(
      [],
      [{ type: "EXPENSE", incomeCategory: null, category: "FIXED", label: "Rent", budget: 1200, sourceCategoryId: "c3" }],
      65,
    );
    expect(r.expenses).toEqual([
      { label: "Rent", category: "FIXED", annualAmount: 14400, inflationLinked: true, sourceCategoryId: "c3" },
    ]);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`pnpm test src/lib/plan/seed.test.ts`).

- [ ] **Step 3: Implement**

```ts
// src/lib/plan/seed.ts
import type {
  BalanceItemCategory,
  BalanceItemType,
  ExpenseCategory,
  IncomeCategory,
  ItemType,
  PlanAssetWrapper,
  PlanIncomeKind,
} from "@prisma/client";

export interface SeedBalanceItem {
  id: string;
  type: BalanceItemType;
  category: BalanceItemCategory;
  label: string;
  value: number;
}
export interface SeedFinancialItem {
  type: ItemType;
  incomeCategory: IncomeCategory | null;
  category: ExpenseCategory | null;
  label: string;
  budget: number;
  sourceCategoryId: string | null;
}

export interface SeededAsset {
  label: string;
  wrapper: PlanAssetWrapper;
  openingValue: number;
  annualContribution: number;
  drawdownPriority: number;
  sourceBalanceItemId: string;
}
export interface SeededLiability {
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
}
export interface SeededIncome {
  label: string;
  kind: PlanIncomeKind;
  annualAmount: number;
  taxable: boolean;
  growthKind: "INFLATION";
  endAge: number | null;
}
export interface SeededExpense {
  label: string;
  category: ExpenseCategory | null;
  annualAmount: number;
  inflationLinked: boolean;
  sourceCategoryId: string | null;
}
export interface SeededChildren {
  assets: SeededAsset[];
  liabilities: SeededLiability[];
  incomes: SeededIncome[];
  expenses: SeededExpense[];
}

const DRAWDOWN_BY_CATEGORY: Record<BalanceItemCategory, number> = {
  CURRENT: 0,
  MEDIUM_TERM: 1,
  LONG_TERM: 2,
  OTHER: 3,
  PROPERTY: 9,
};

const INCOME_KIND_BY_BUCKET: Record<IncomeCategory, PlanIncomeKind> = {
  SALARY: "SALARY",
  PENSIONS: "DB_PENSION",
  SIDE_INCOME: "SELF_EMPLOYMENT",
  INVESTMENTS: "OTHER",
  OTHER: "OTHER",
};

export function seedPlanChildren(
  balanceItems: SeedBalanceItem[],
  financialItems: SeedFinancialItem[],
  retirementAge: number,
): SeededChildren {
  const assets: SeededAsset[] = [];
  const liabilities: SeededLiability[] = [];
  for (const b of balanceItems) {
    if (b.type === "ASSET") {
      assets.push({
        label: b.label,
        wrapper: "OTHER",
        openingValue: b.value,
        annualContribution: 0,
        drawdownPriority: DRAWDOWN_BY_CATEGORY[b.category],
        sourceBalanceItemId: b.id,
      });
    } else {
      liabilities.push({
        label: b.label,
        openingBalance: b.value,
        interestPct: 0,
        monthlyRepayment: 0,
      });
    }
  }

  const incomes: SeededIncome[] = [];
  const expenses: SeededExpense[] = [];
  for (const f of financialItems) {
    if (f.type === "INCOME") {
      const kind = f.incomeCategory ? INCOME_KIND_BY_BUCKET[f.incomeCategory] : "OTHER";
      incomes.push({
        label: f.label,
        kind,
        annualAmount: f.budget * 12,
        taxable: true,
        growthKind: "INFLATION",
        endAge: kind === "SALARY" ? retirementAge : null,
      });
    } else {
      expenses.push({
        label: f.label,
        category: f.category,
        annualAmount: f.budget * 12,
        inflationLinked: true,
        sourceCategoryId: f.sourceCategoryId,
      });
    }
  }

  return { assets, liabilities, incomes, expenses };
}
```

- [ ] **Step 4: Run → PASS** (4 cases).
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean.
- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/seed.ts src/lib/plan/seed.test.ts
git commit -m "feat(plan): seed plan children from Balance + Budget rows"
```

---

## Task 3: DB → engine mapping (`toPlanInput.ts`)

**Files:**
- Create: `src/lib/plan/toPlanInput.ts`
- Test: `src/lib/plan/toPlanInput.test.ts`

**Interfaces:**
- Consumes: Prisma row types (`Plan`, `PlanAsset`, …) from `@prisma/client`; engine `PlanInput`/`PlanProjection`/`Wrapper`/`IncomeKind` from `@/lib/plan`.
- Produces: `type PlanWithChildren`; `toPlanInput(plan, asOfYear) → PlanInput`; `toTodaysMoney(projection, inflationPct, currentAge) → PlanProjection`. Consumed by the page (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/toPlanInput.test.ts
import { project } from "@/lib/plan";
import { type PlanWithChildren, toPlanInput, toTodaysMoney } from "./toPlanInput";

const d = (n: number) => ({ toString: () => String(n) }) as unknown as PlanWithChildren["inflationPct"];

const basePlan = (over: Partial<PlanWithChildren> = {}): PlanWithChildren => ({
  id: "p1", userId: "u1", name: "My plan",
  dateOfBirth: new Date("1986-06-01"),
  retirementAge: 65, planToAge: 90,
  inflationPct: d(2.5), defaultReturnPct: d(5), blendedTaxRatePct: d(20),
  statePensionAge: 67, statePensionAnnual: d(11000),
  isPrimary: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  assets: [], liabilities: [], incomes: [], expenses: [], events: [],
  ...over,
});

describe("toPlanInput", () => {
  it("derives currentAge and startYear from dateOfBirth and asOfYear", () => {
    const input = toPlanInput(basePlan(), 2026);
    expect(input.currentAge).toBe(40); // 2026 - 1986
    expect(input.startYear).toBe(2026);
    expect(input.taxRatePct).toBe(20);
    expect(input.statePension).toEqual({ startAge: 67, annualAmount: 11000 });
  });

  it("omits statePension when age or amount is missing", () => {
    const input = toPlanInput(basePlan({ statePensionAge: null }), 2026);
    expect(input.statePension).toBeUndefined();
  });

  it("maps an asset, leaving expectedReturnPct undefined when null", () => {
    const input = toPlanInput(
      basePlan({
        assets: [{
          id: "a1", planId: "p1", label: "SIPP", wrapper: "PENSION",
          openingValue: d(100000), expectedReturnPct: null, annualContribution: d(6000),
          contributionEndAge: null, drawdownPriority: 2, sourceBalanceItemId: null,
          sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
        }],
      }),
      2026,
    );
    expect(input.assets[0]).toMatchObject({
      id: "a1", label: "SIPP", wrapper: "PENSION", openingValue: 100000,
      annualContribution: 6000, drawdownPriority: 2,
    });
    expect(input.assets[0]?.expectedReturnPct).toBeUndefined();
  });

  it("the mapped plan runs through the engine", () => {
    const out = project(toPlanInput(basePlan(), 2026));
    expect(out.years[0]?.age).toBe(40);
    expect(out.years.at(-1)?.age).toBe(90);
  });
});

describe("toTodaysMoney", () => {
  it("deflates money by inflation over elapsed years", () => {
    const out = project(toPlanInput(basePlan({ planToAge: 41 }), 2026));
    const real = toTodaysMoney(out, 10, 40); // 10% inflation
    // age 41 is 1 year out → divide by 1.1
    const nominal41 = out.years.find((y) => y.age === 41);
    const real41 = real.years.find((y) => y.age === 41);
    expect(real41?.netWorth).toBeCloseTo((nominal41?.netWorth ?? 0) / 1.1, 0);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/plan/toPlanInput.ts
import type {
  Plan, PlanAsset, PlanEvent, PlanExpense, PlanIncome, PlanLiability,
} from "@prisma/client";
import type { Growth, PlanInput, PlanProjection } from "@/lib/plan";

export type PlanWithChildren = Plan & {
  assets: PlanAsset[];
  liabilities: PlanLiability[];
  incomes: PlanIncome[];
  expenses: PlanExpense[];
  events: PlanEvent[];
};

const num = (d: { toString(): string }): number => Number(d.toString());
const optNum = (d: { toString(): string } | null): number | undefined =>
  d === null ? undefined : Number(d.toString());

const growthOf = (kind: PlanIncome["growthKind"], pct: number | undefined): Growth => {
  if (kind === "FIXED") return { kind: "FIXED", pct: pct ?? 0 };
  if (kind === "NONE") return { kind: "NONE" };
  return { kind: "INFLATION" };
};

export function toPlanInput(plan: PlanWithChildren, asOfYear: number): PlanInput {
  const currentAge = asOfYear - plan.dateOfBirth.getUTCFullYear();
  const statePension =
    plan.statePensionAge !== null && plan.statePensionAnnual !== null
      ? { startAge: plan.statePensionAge, annualAmount: num(plan.statePensionAnnual) }
      : undefined;

  return {
    currentAge,
    startYear: asOfYear,
    retirementAge: plan.retirementAge,
    planToAge: plan.planToAge,
    inflationPct: num(plan.inflationPct),
    defaultReturnPct: num(plan.defaultReturnPct),
    taxRatePct: num(plan.blendedTaxRatePct),
    statePension,
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      openingValue: num(a.openingValue),
      expectedReturnPct: optNum(a.expectedReturnPct),
      annualContribution: num(a.annualContribution),
      contributionEndAge: a.contributionEndAge ?? undefined,
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      openingBalance: num(l.openingBalance),
      interestPct: num(l.interestPct),
      monthlyRepayment: num(l.monthlyRepayment),
      endAge: l.endAge ?? undefined,
      linkedAssetId: l.linkedAssetId ?? undefined,
    })),
    incomes: plan.incomes.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      annualAmount: num(i.annualAmount),
      startAge: i.startAge ?? undefined,
      endAge: i.endAge ?? undefined,
      growth: growthOf(i.growthKind, optNum(i.growthPct)),
      taxable: i.taxable,
    })),
    expenses: plan.expenses.map((e) => ({
      id: e.id,
      label: e.label,
      category: e.category ?? undefined,
      annualAmount: num(e.annualAmount),
      startAge: e.startAge ?? undefined,
      endAge: e.endAge ?? undefined,
      inflationLinked: e.inflationLinked,
    })),
    events: plan.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      amount: num(ev.amount),
    })),
  };
}

// Engine output is nominal (future £). Deflate to today's money for display.
export function toTodaysMoney(
  projection: PlanProjection,
  inflationPct: number,
  currentAge: number,
): PlanProjection {
  const deflate = (value: number, age: number): number =>
    Math.round(value / (1 + inflationPct / 100) ** (age - currentAge));

  return {
    verdict: {
      ...projection.verdict,
      peakNetWorth: {
        age: projection.verdict.peakNetWorth.age,
        value: deflate(projection.verdict.peakNetWorth.value, projection.verdict.peakNetWorth.age),
      },
    },
    years: projection.years.map((y) => ({
      ...y,
      grossIncome: deflate(y.grossIncome, y.age),
      tax: deflate(y.tax, y.age),
      netIncome: deflate(y.netIncome, y.age),
      totalExpenses: deflate(y.totalExpenses, y.age),
      liabilityRepayments: deflate(y.liabilityRepayments, y.age),
      surplus: deflate(y.surplus, y.age),
      contributions: deflate(y.contributions, y.age),
      withdrawals: deflate(y.withdrawals, y.age),
      liabilitiesTotal: deflate(y.liabilitiesTotal, y.age),
      netWorth: deflate(y.netWorth, y.age),
      incomeByKind: Object.fromEntries(
        Object.entries(y.incomeByKind).map(([k, v]) => [k, deflate(v, y.age)]),
      ),
      expensesByCategory: Object.fromEntries(
        Object.entries(y.expensesByCategory).map(([k, v]) => [k, deflate(v, y.age)]),
      ),
      assets: y.assets.map((a) => ({
        ...a,
        value: deflate(a.value, y.age),
        contributed: deflate(a.contributed, y.age),
        withdrawn: deflate(a.withdrawn, y.age),
      })),
      liabilities: y.liabilities.map((l) => ({ ...l, value: deflate(l.value, y.age) })),
    })),
  };
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean. (If Prisma's `PlanAssetWrapper`/`PlanIncomeKind` enum types don't directly satisfy the engine's `Wrapper`/`IncomeKind` string unions, they share identical members so assignment typechecks; do **not** add `as` casts unless the compiler demands it — if it does, prefer mapping over `as`.)
- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/toPlanInput.ts src/lib/plan/toPlanInput.test.ts
git commit -m "feat(plan): map persisted Plan to engine input + today's-money transform"
```

---

## Task 4: Net-worth chart data (`chartData.ts`)

**Files:**
- Create: `src/lib/plan/chartData.ts`
- Test: `src/lib/plan/chartData.test.ts`

**Interfaces:**
- Consumes: `YearProjection`, `Wrapper`, `WRAPPERS` from `@/lib/plan`.
- Produces: `type NetWorthDatum`; `toNetWorthChartData(years) → NetWorthDatum[]`; `wrappersPresent(rows) → Wrapper[]`. Consumed by `NetWorthChart` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/chartData.test.ts
import type { YearProjection } from "@/lib/plan";
import { toNetWorthChartData, wrappersPresent } from "./chartData";

const year = (over: Partial<YearProjection> & { age: number }): YearProjection => ({
  year: 2000 + over.age, grossIncome: 0, incomeByKind: {}, tax: 0, netIncome: 0,
  expensesByCategory: {}, totalExpenses: 0, liabilityRepayments: 0,
  surplus: 0, contributions: 0, withdrawals: 0,
  assets: [], liabilities: [], liabilitiesTotal: 0, netWorth: 0, shortfall: false, ...over,
});

describe("toNetWorthChartData", () => {
  it("aggregates assets by wrapper (positive) and debt as one negative segment", () => {
    const rows = toNetWorthChartData([
      year({
        age: 40, netWorth: 90000,
        assets: [
          { id: "a", label: "SIPP", wrapper: "PENSION", value: 80000, contributed: 0, withdrawn: 0 },
          { id: "b", label: "Cash", wrapper: "CASH", value: 30000, contributed: 0, withdrawn: 0 },
        ],
        liabilities: [{ id: "m", label: "Mortgage", value: 20000 }],
        liabilitiesTotal: 20000,
      }),
    ]);
    expect(rows[0]).toMatchObject({ age: 40, PENSION: 80000, CASH: 30000, debt: -20000, netWorth: 90000 });
  });

  it("wrappersPresent lists only wrappers with a non-zero value, in WRAPPERS order", () => {
    const rows = toNetWorthChartData([
      year({ age: 40, assets: [{ id: "b", label: "Cash", wrapper: "CASH", value: 30000, contributed: 0, withdrawn: 0 }] }),
    ]);
    expect(wrappersPresent(rows)).toEqual(["CASH"]);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/plan/chartData.ts
import { type Wrapper, WRAPPERS, type YearProjection } from "@/lib/plan";

export type NetWorthDatum = { age: number; debt: number; netWorth: number } & Partial<
  Record<Wrapper, number>
>;

// One row per year: each wrapper's summed asset value (positive), the total
// debt as a single negative `debt` segment, and the net-worth line value.
export function toNetWorthChartData(years: YearProjection[]): NetWorthDatum[] {
  return years.map((y) => {
    const byWrapper: Partial<Record<Wrapper, number>> = {};
    for (const a of y.assets) {
      byWrapper[a.wrapper] = (byWrapper[a.wrapper] ?? 0) + a.value;
    }
    return { age: y.age, ...byWrapper, debt: -y.liabilitiesTotal, netWorth: y.netWorth };
  });
}

// Which wrappers actually carry value anywhere in the series (for which <Bar>s
// to render), in canonical WRAPPERS order.
export function wrappersPresent(rows: NetWorthDatum[]): Wrapper[] {
  return WRAPPERS.filter((w) => rows.some((r) => (r[w] ?? 0) !== 0));
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean.
- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/chartData.ts src/lib/plan/chartData.test.ts
git commit -m "feat(plan): net-worth stacked-bar chart data shaping"
```

---

## Task 5: `createPlan` server action

**Files:**
- Create: `src/app/plan/actions.ts`
- Test: `src/app/plan/actions.int.test.ts`

**Interfaces:**
- Consumes: `seedPlanChildren` (Task 2); Prisma client.
- Produces: `createPlan(input: { dateOfBirth: string; retirementAge: number }) → Promise<void>`; `getPrimaryPlan(userId) → Promise<PlanWithChildren | null>`. Consumed by the page (Task 7).

- [ ] **Step 1: Write the failing integration test** (runs against real `halcyon_test`; mirrors existing `*.int.test.ts`). Use the repo's existing int-test helpers for creating a user + auth mock — match the pattern in another `*.int.test.ts` (e.g. `src/app/balance/*.int.test.ts` if present, else `src/app/settings/dataActions.int.test.ts`). The essential assertions:

```ts
// src/app/plan/actions.int.test.ts
import { prisma } from "@/lib/prisma";
import { createPlan, getPrimaryPlan } from "./actions";
// ... import the repo's int-test auth/user setup helpers (copy the header of a sibling *.int.test.ts) ...

describe("createPlan (integration)", () => {
  it("seeds a primary plan from the user's latest balance + budget period", async () => {
    // ARRANGE: create a user, a FinancialPeriod with a balance ASSET item and an INCOME item.
    // (use the same helpers/setup the sibling int tests use; set the mocked auth user to this user)
    // ACT
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });
    // ASSERT
    const plan = await getPrimaryPlan(/* userId */);
    expect(plan).not.toBeNull();
    expect(plan?.isPrimary).toBe(true);
    expect(plan?.assets.length).toBeGreaterThan(0);
    expect(plan?.assets[0]?.wrapper).toBe("OTHER");
    expect(plan?.incomes.length).toBeGreaterThan(0);
  });

  it("does not create a second plan when a primary already exists", async () => {
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });
    await createPlan({ dateOfBirth: "1990-01-01", retirementAge: 60 });
    const count = await prisma.plan.count({ where: { /* userId */ deletedAt: null } });
    expect(count).toBe(1);
  });
});
```

> Open the chosen sibling `*.int.test.ts` and copy its exact setup header (how it provisions a user, mocks `createClient`/`auth.getUser`, and cleans up between tests). Wire the mocked auth user id into the ARRANGE/ASSERT blocks above.

- [ ] **Step 2: Run → FAIL** (`pnpm test:int` — needs the Task 1 migration applied to `halcyon_test`).

- [ ] **Step 3: Implement**

```ts
// src/app/plan/actions.ts
"use server";

import { type SeedBalanceItem, type SeedFinancialItem, seedPlanChildren } from "@/lib/plan/seed";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/plan");
  return user.id;
}

export async function getPrimaryPlan(userId: string) {
  return prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    include: {
      assets: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      liabilities: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      incomes: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      expenses: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      events: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
}

const createPlanSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(90),
});

export async function createPlan(input: { dateOfBirth: string; retirementAge: number }) {
  const userId = await requireUserId();
  const { dateOfBirth, retirementAge } = createPlanSchema.parse(input);

  // One primary plan per user (v1).
  const existing = await prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/plan");
    return;
  }

  // Seed from the most recent non-deleted month period (balance + budget share it).
  const period = await prisma.financialPeriod.findFirst({
    where: { userId, granularity: "MONTH", deletedAt: null },
    orderBy: { startDate: "desc" },
    include: {
      balanceItems: { where: { deletedAt: null } },
      items: { where: { deletedAt: null } },
    },
  });

  const balanceItems: SeedBalanceItem[] = (period?.balanceItems ?? []).map((b) => ({
    id: b.id,
    type: b.type,
    category: b.category,
    label: b.label,
    value: Number(b.value),
  }));
  const financialItems: SeedFinancialItem[] = (period?.items ?? []).map((f) => ({
    type: f.type,
    incomeCategory: f.incomeCategory,
    category: f.category,
    label: f.label,
    budget: Number(f.budget),
    sourceCategoryId: f.categoryId,
  }));

  const seeded = seedPlanChildren(balanceItems, financialItems, retirementAge);

  await prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date(dateOfBirth),
      retirementAge,
      statePensionAge: 67,
      statePensionAnnual: 11500,
      assets: { create: seeded.assets },
      liabilities: { create: seeded.liabilities },
      incomes: { create: seeded.incomes },
      expenses: { create: seeded.expenses },
    },
  });

  revalidatePath("/plan");
}
```

- [ ] **Step 4: Run → PASS** (`pnpm test:int`).
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean.
- [ ] **Step 6: Commit**

```bash
git add src/app/plan/actions.ts src/app/plan/actions.int.test.ts
git commit -m "feat(plan): createPlan action seeding from Balance + Budget"
```

---

## Task 6: Chart + verdict + colours components

**Files:**
- Create: `src/app/plan/colours.ts`
- Create: `src/app/plan/NetWorthChart.tsx`
- Create: `src/app/plan/VerdictBanner.tsx`

**Interfaces:**
- Consumes: `toNetWorthChartData`, `wrappersPresent`, `type NetWorthDatum` (Task 4); engine `type Verdict`, `type YearProjection`, `type Wrapper`; currency helpers `symbolFor`, `formatAmount`, `type NumberFormat` from `@/lib/settings/currency`.
- Produces: `<NetWorthChart years currency numberFormat />`, `<VerdictBanner verdict currency numberFormat />`, `WRAPPER_COLOURS`. Consumed by `PlanView` (Task 7).

- [ ] **Step 1: Colours map** `src/app/plan/colours.ts`

```ts
// src/app/plan/colours.ts
import type { Wrapper } from "@/lib/plan";

export const WRAPPER_COLOURS: Record<Wrapper, string> = {
  PENSION: "#1E5BC6",
  ISA: "#1F8A4C",
  GIA: "#7C3AED",
  CASH: "#0EA5A4",
  PROPERTY: "#D97706",
  DB_PENSION: "#475569",
  OTHER: "#94A3B8",
};

export const DEBT_COLOUR = "#B33B3B";
export const NET_WORTH_COLOUR = "#0F1116";
```

- [ ] **Step 2: VerdictBanner** `src/app/plan/VerdictBanner.tsx`

```tsx
// src/app/plan/VerdictBanner.tsx
"use client";

import type { Verdict } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import styled from "styled-components";

const Banner = styled.div<{ $ok: boolean }>`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-left: 4px solid
    ${({ theme, $ok }) => ($ok ? theme.colors.positive : theme.colors.negative)};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.canvas};
`;

const Headline = styled.p`
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

const Sub = styled.p`
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
`;

export function VerdictBanner({
  verdict,
  currency,
  numberFormat,
}: {
  verdict: Verdict;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const peak = formatAmount(currency, verdict.peakNetWorth.value, numberFormat);
  const headline = verdict.feasible
    ? `On track — your money lasts the plan`
    : `Runs short at age ${verdict.firstShortfallAge}`;
  const earliest =
    verdict.earliestSustainableRetirementAge !== null
      ? `Earliest sustainable retirement: age ${verdict.earliestSustainableRetirementAge}.`
      : `No retirement age in range is sustainable yet.`;

  return (
    <Banner $ok={verdict.feasible}>
      <Headline>{headline}</Headline>
      <Sub>
        Peak net worth {peak} at age {verdict.peakNetWorth.age} (today's money). {earliest}
      </Sub>
    </Banner>
  );
}
```

- [ ] **Step 3: NetWorthChart** `src/app/plan/NetWorthChart.tsx` — copy the structure of `src/app/dashboard/CashFlowChart.tsx` (read it first). Stacked `Bar`s per present wrapper (`stackId="nw"`), a negative `debt` bar in the same stack, a net-worth `Line`, a zero `ReferenceLine`.

```tsx
// src/app/plan/NetWorthChart.tsx
"use client";

import { toNetWorthChartData, wrappersPresent } from "@/lib/plan/chartData";
import type { YearProjection } from "@/lib/plan";
import { type NumberFormat, formatAmount, symbolFor } from "@/lib/settings/currency";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { DEBT_COLOUR, NET_WORTH_COLOUR, WRAPPER_COLOURS } from "./colours";

export function NetWorthChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toNetWorthChartData(years);
  const wrappers = wrappersPresent(data);

  const amountTick = (v: number) => {
    const sym = symbolFor(currency);
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    return abs >= 1000 ? `${sign}${sym}${Math.round(abs / 1000)}k` : `${sign}${sym}${abs}`;
  };

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          formatter={(value, name) => [formatAmount(currency, Number(value), numberFormat), name]}
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke={theme.colors.hairlineStrong} />
        {wrappers.map((w) => (
          <Bar
            key={w}
            dataKey={w}
            name={w}
            stackId="nw"
            fill={WRAPPER_COLOURS[w]}
            isAnimationActive={false}
          />
        ))}
        <Bar
          dataKey="debt"
          name="Debt"
          stackId="nw"
          fill={DEBT_COLOUR}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Net worth"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm check`
Expected: PASS, 0 errors. (Recharts chart components aren't unit-tested in this repo — the data shaping is covered by Task 4; correctness of render is verified in Task 7's manual check + `pnpm build`.)

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/colours.ts src/app/plan/NetWorthChart.tsx src/app/plan/VerdictBanner.tsx
git commit -m "feat(plan): net-worth chart, verdict banner, wrapper colours"
```

---

## Task 7: Page, view, empty state, nav

**Files:**
- Create: `src/app/plan/page.tsx`
- Create: `src/app/plan/PlanView.tsx`
- Create: `src/app/plan/CreatePlanForm.tsx`
- Modify: `src/components/ui/NavBar/index.tsx`

**Interfaces:**
- Consumes: `getPrimaryPlan`, `createPlan` (Task 5); `toPlanInput`, `toTodaysMoney` (Task 3); `project` (engine); `NetWorthChart`, `VerdictBanner` (Task 6); `getCurrentUserSettings` (`@/lib/settings/server`).

- [ ] **Step 1: Empty-state form** `src/app/plan/CreatePlanForm.tsx`

```tsx
// src/app/plan/CreatePlanForm.tsx
"use client";

import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { createPlan } from "./actions";

const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 320px;
`;
const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;
const Input = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;

export function CreatePlanForm() {
  const [pending, startTransition] = useTransition();
  const [dob, setDob] = useState("");
  const [retirementAge, setRetirementAge] = useState(67);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          createPlan({ dateOfBirth: dob, retirementAge });
        });
      }}
    >
      <Field>
        Date of birth
        <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
      </Field>
      <Field>
        Target retirement age
        <Input
          type="number"
          min={40}
          max={90}
          value={retirementAge}
          onChange={(e) => setRetirementAge(Number(e.target.value))}
          required
        />
      </Field>
      <Button type="submit" disabled={pending || !dob}>
        Create my plan
      </Button>
    </Form>
  );
}
```

- [ ] **Step 2: PlanView** `src/app/plan/PlanView.tsx`

```tsx
// src/app/plan/PlanView.tsx
"use client";

import type { Verdict, YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import styled from "styled-components";
import { NetWorthChart } from "./NetWorthChart";
import { VerdictBanner } from "./VerdictBanner";

const Shell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]} ${({ theme }) => theme.spacing["2xl"]};
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
`;
const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.displayXl.size};
  font-weight: ${({ theme }) => theme.typography.displayXl.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

export function PlanView({
  years,
  verdict,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  verdict: Verdict;
  currency: string;
  numberFormat: NumberFormat;
}) {
  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner verdict={verdict} currency={currency} numberFormat={numberFormat} />
      <NetWorthChart years={years} currency={currency} numberFormat={numberFormat} />
    </Shell>
  );
}
```

- [ ] **Step 3: Page** `src/app/plan/page.tsx`

```tsx
// src/app/plan/page.tsx
import { project } from "@/lib/plan";
import { toPlanInput, toTodaysMoney } from "@/lib/plan/toPlanInput";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPrimaryPlan } from "./actions";
import { CreatePlanForm } from "./CreatePlanForm";
import { PlanView } from "./PlanView";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/plan");

  const { currency, numberFormat } = await getCurrentUserSettings();
  const plan = await getPrimaryPlan(user.id);

  if (!plan) {
    return <CreatePlanForm />;
  }

  const asOfYear = new Date().getUTCFullYear();
  const input = toPlanInput(plan, asOfYear);
  const projection = toTodaysMoney(project(input), input.inflationPct, input.currentAge);

  return (
    <PlanView
      years={projection.years}
      verdict={projection.verdict}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
}
```

> Note: `getPrimaryPlan` returns Prisma rows (with `Decimal`/`Date`); `toPlanInput` consumes them server-side and the engine output passed to the client (`PlanView`) is already plain `number`/`string` — safe to serialize across the server/client boundary. The `CreatePlanForm` empty state is a minimal stand-in; a polished empty state + `PageHeader` is Phase 1b.

- [ ] **Step 4: Add the nav link** — in `src/components/ui/NavBar/index.tsx`, add Plan to `SIGNED_IN_ITEMS` (before Settings):

```ts
const SIGNED_IN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
];
```

(The `planVisible` toggle that can hide this is Phase 1b; for now it's always shown.)

- [ ] **Step 5: Verify build + manual check**

Run: `pnpm typecheck && pnpm check && pnpm build`
Expected: PASS; the build's route list now includes `ƒ /plan`.
Manual: `pnpm dev`, sign in, visit `/plan` → if no plan, the create form shows; submit DOB + retirement age → the page renders the verdict banner + net-worth chart from seeded data. (Requires existing Balance/Budget data to seed from; otherwise the chart shows the synthetic-cash baseline.)

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/page.tsx src/app/plan/PlanView.tsx src/app/plan/CreatePlanForm.tsx src/components/ui/NavBar/index.tsx
git commit -m "feat(plan): /plan route — render projection or create-plan empty state + nav link"
```

---

## Self-review notes

- **Spec coverage:** §3 models+planVisible → T1; §4 seeding → T2; §5 mapping+today's-money → T3; §7 chart/verdict → T6, chart data → T4; §6 create flow + route + nav → T5, T7; §9 tests → unit (T2,T3,T4), integration (T5). The accepted `wrapper: OTHER` limitation is honoured (T2 seeds OTHER; T6 renders whatever wrappers are present).
- **Determinism:** the only `new Date()` is at the app boundary (`page.tsx`, `actions.ts`) — `toPlanInput`/`toTodaysMoney`/engine stay `Date`-free and unit-tested.
- **Type consistency:** `seedPlanChildren`, `PlanWithChildren`, `toPlanInput`, `toTodaysMoney`, `toNetWorthChartData`, `wrappersPresent`, `getPrimaryPlan`, `createPlan`, `WRAPPER_COLOURS` are used with identical signatures across tasks. Prisma enum values (`PlanAssetWrapper`, `PlanIncomeKind`) share members with engine unions (`Wrapper`, `IncomeKind`).
- **Migration risk:** T1 needs Docker (container-only migrations) and the schema applied to `halcyon_test` before T5. If Docker is unavailable at execution, T1/T5 will block — surface it rather than running host migrations.
- **Out of scope (Phase 1b):** editing assumptions/assets/liabilities/incomes/expenses, the `planVisible` toggle UI, add/remove lines, the cashflow chart, sliders.

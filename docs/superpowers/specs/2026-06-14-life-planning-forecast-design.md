# Life Planning & Forecasting — Design

**Date:** 2026-06-14
**Status:** In design (brainstorm) — pending spec review, then implementation plan
**Related:** [ADR-001 (Tech Stack)](../../ADRs/ADR-001-TechStackSelection.md), [ADR-002 (Security)](../../ADRs/ADR-002-SecurityArchitecture.md), [ADR-003 (DB Migrations)](../../ADRs/ADR-003-DBMigrations.md), [Data Models](../../DataModels/DataModels.md), [Auth](../../features/auth.md)

## 1. Vision

A **lifetime cashflow modelling** feature — the forward-looking counterpart to the app's existing
backward-looking tracking (dashboard, budget, balance, transactions). Inspired by
[Voyant's "Let's See" screen](https://support.planwithvoyant.com/hc/en-us/articles/360038450712).

It answers one core question:

> **With your current assets and savings, can you retire — and if so, when, and does the money last?**

The user builds a **Plan** — opening assets/liabilities, income and expense streams, and one-off
events, plus global assumptions — and the app projects it **year-by-year across their whole life**,
rendering a Voyant-style stacked cashflow chart and a net-worth view, with the year money runs short
flagged in **red**. Sliders (return, inflation, retirement age) recompute the projection live.

This is the **largest feature in the app**. It marries historic tracking with future planning.

## 2. Scope

### In scope for v1 (what this spec details)

- A **pure projection engine** (`src/lib/plan/`) — the keystone, built and tested headless first.
- A persisted **Plan** data model and a `plan/` route that renders the projection from real data.
- **Seeding from existing app data** (Balance sheet → assets/liabilities; Budget → income/expenses)
  **with manual entry as a first-class, always-available path** (a plan may start blank and be built
  by hand — see §6).
- **Simplified UK tax** behind a swappable seam (a blended-rate stub in v1; real bands later).
- **Individual** modelling (one person). The schema is shaped so a partner can be added later.
- Currency/locale: **GBP, UK tax assumptions** (the product ships as Balanced Money / balanced.money),
  even though `UserSettings.currency` defaults to `USD`.

### Explicitly deferred (model allows, not built in v1)

- **Household / couples** (two people, joint assets, survivor planning).
- **Bank connections / open banking** — CSV import + manual remain the ingestion story.
- **Real UK tax engine** (exact bands, NI, dividend/CGT, taper) — v1 uses a blended-rate stub.
- **External inflation API** — v1 uses a manual inflation assumption; a live feed is a later phase.
- **Stochastic / Monte-Carlo range band** — the 10–90% fan in the early mockups is **not v1**.
  v1 ships deterministic median projection; an optimistic/pessimistic pair (return ± delta) is the
  cheap interim, full Monte-Carlo is a later phase. *(Decision: flagged in §10.)*
- **Saved/compared scenarios UI** — the model supports many plans per user; v1 surfaces one.
- **Allowance-aware contributions and tax-optimised decumulation** — v1 uses simple rules (§7).

## 3. Phased delivery

Each phase is independently shippable and gets its own plan → build cycle. Ordering puts the riskiest
math first, behind a pure boundary, so later phases are mechanical.

| Phase | Ships | Depends on |
|---|---|---|
| **0 · Projection engine** | Pure TS in `src/lib/plan/`; TDD; no UI. Tax enters as a swappable stub. | — |
| **1 · Static plan page** | `plan/` route + Prisma models; seed from Balance/Budget + manual; render stacked cashflow + net-worth charts. | 0 |
| **2 · Life-events Gantt** | Interactive CRUD of streams/events on a timeline; Cash flow / Liquid assets / Net worth view switch; blue→red shortfall. | 1 |
| **3 · Real-time sliders** | Drag return / inflation / retirement age → instant client-side recompute (engine is pure). | 0, 2 |
| **4 · Simplified UK tax** | Replace the stub: bands, personal allowance, pension relief, 25% tax-free lump sum, state pension. | 0 |
| **5 · External inflation feed** | Live historic + projected inflation API; manual fallback. (Optional: Monte-Carlo band.) | 0 |
| **6 · Scenarios** *(optional)* | Multiple named plans, compared side-by-side. | 1 |

**This spec is the foundation: Phase 0 (engine) + Phase 1 (data model + static page).** Later phases
are described as roadmap and will each get their own spec.

## 4. What "a Plan" is

> A **Plan** is a saved, lifelong what-if for one user: opening **assets** & **liabilities**, **income
> streams**, **expense streams**, and one-off **events**, plus global **assumptions** (date of birth,
> retirement age, plan-to age, inflation, per-wrapper return defaults, state pension). The engine
> projects it **year-by-year (indexed by age)** to determine whether the money lasts and, if not, the
> age it runs short.

Global **assumptions** = date of birth, retirement age, plan-to age, inflation, a **default return
rate (overridable per asset)**, and state pension.

### Snapshot vs projection — why existing models aren't reused directly

`BalanceItem` is a **monthly snapshot**: a `value` plus a liquidity bucket
(`CURRENT/MEDIUM_TERM/LONG_TERM/PROPERTY/OTHER`). A forecast needs what a snapshot lacks — a **tax
wrapper**, an **expected return**, **contribution rules**, and a **drawdown order**. So Balance items
**seed** a plan's assets via a one-time copy carrying provenance (`sourceBalanceItemId`); the plan then
owns richer asset rows that live independently. The seed is **not a live link** — editing a what-if
must never mutate the real balance sheet.

## 5. The yearly waterfall (engine algorithm)

The single modelling decision that drives everything. For each projected year (from current age to
`planToAge`):

```
1. gross income   = Σ active income streams (salary, state/DB pension, rental, …), grown per their rule
2. tax            = TaxFn(taxContext)            ← swappable seam (stub in v1)
3. net income     = gross income − tax
4. outgoings      = Σ active expense streams (inflation-linked) + liability repayments
5. surplus        = net income − outgoings        (may be negative)
6a. surplus > 0   → contribute to assets (per-asset regular contributions, then a default destination)
6b. surplus < 0   → withdraw from assets in drawdownPriority order
                    └─ when drawable assets hit £0 and surplus is still negative ⇒ SHORTFALL (red)
7. grow assets    = each asset × its expected return; liabilities accrue interest, reduce by repayment
8. apply events   = one-off inflows/outflows landing this age (e.g. inheritance, house deposit)
9. record         = a YearProjection row (see §8)
```

**Savings is *derived*** (income − tax − outgoings), not a primary input — truthful, and how Voyant
works. The mockup's "savings rate" slider becomes explicit per-asset contributions plus a global
contribution multiplier.

**Default drawdown order** (v1, simplistic): `CASH → GIA → ISA → PENSION` (pension last for tax/IHT
reasons). Overridable per asset via `drawdownPriority`. Tax-optimised ordering is deferred.

**Default contribution destination** (v1): honour explicit per-asset `monthlyContribution` first, then
route remaining surplus to the highest-priority accumulation asset. Allowance caps (ISA/pension
annual allowance) are deferred to Phase 4.

## 6. Seeding from app data vs manual

Both paths are first-class. A new plan **starts empty**; the user either:

- **"Import from my balance sheet"** — copy the latest non-deleted period's `BalanceItem`s into
  `PlanAsset`/`PlanLiability` (value + provenance; wrapper guessed, see below), and optionally pull
  `FinancialItem` income/expense baselines into `PlanIncome`/`PlanExpense`; **or**
- **Add everything manually** — the default offered for users who want a clean what-if.

**Wrapper guess heuristic** when seeding an asset from a `BalanceItem` (user can correct after):

| Signal | Wrapper |
|---|---|
| category = PROPERTY | PROPERTY |
| label matches /pension|sipp/i | PENSION |
| label matches /isa/i | ISA |
| label matches /cash|current|savings/i | CASH |
| otherwise | GIA (taxable) |

The guessed wrapper also **suggests** a starting return for the new asset (e.g. CASH ≈ 1%, equity
wrappers ≈ 5%), pre-filling `expectedReturnPct` — always editable, and falling back to the plan's
`defaultReturnPct` if cleared.

**Income/expense seed:** latest period's `FinancialItem`s, `annualAmount = monthly × 12` (or averaged
actuals where the transactions feature is on). Income `kind` derived from `incomeCategory`
(`SALARY→SALARY`, `PENSIONS→DB_PENSION`, else `OTHER`); expense `category` carried from the bucket.

## 7. Engine contract (Phase 0 — pure, headless, TDD)

Lives in `src/lib/plan/`. No I/O, no Prisma, no React — deterministic pure functions so the same code
runs server-side **and** client-side (enabling Phase 3 live sliders cheaply). Types are the contract;
implementation is test-driven.

```ts
type Wrapper = "PENSION" | "ISA" | "GIA" | "CASH" | "PROPERTY" | "DB_PENSION" | "OTHER";
type Growth  = { kind: "INFLATION" } | { kind: "FIXED"; pct: number } | { kind: "NONE" };

interface PlanInput {
  currentAge: number;            // derived from dateOfBirth at call time
  retirementAge: number;
  planToAge: number;             // e.g. 95
  inflationPct: number;          // e.g. 2.5
  defaultReturnPct: number;      // plan-wide default; an asset's expectedReturnPct overrides it
  statePension?: { startAge: number; annualAmount: number };
  assets: AssetInput[];
  liabilities: LiabilityInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  events: EventInput[];
  tax: TaxFn;                    // the seam (§9)
}

interface AssetInput {
  id: string; label: string; wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct?: number;    // undefined ⇒ plan defaultReturnPct
  monthlyContribution?: number;
  drawdownPriority: number;
}
interface LiabilityInput {
  id: string; label: string;
  openingBalance: number; interestPct: number; monthlyRepayment: number;
  endAge?: number; linkedAssetId?: string;
}
interface IncomeInput {
  id: string; label: string; kind: IncomeKind;
  annualAmount: number; startAge?: number; endAge?: number;
  growth: Growth; taxable: boolean;
}
interface ExpenseInput {
  id: string; label: string; category?: ExpenseCategory;
  annualAmount: number; startAge?: number; endAge?: number; inflationLinked: boolean;
}
interface EventInput {
  id: string; label: string; age: number;
  direction: "INFLOW" | "OUTFLOW"; amount: number;
}

interface YearProjection {
  age: number; year: number;
  grossIncome: number; tax: number; netIncome: number;
  expensesByCategory: Record<string, number>; totalExpenses: number;
  liabilityRepayments: number;
  surplus: number; contributions: number; withdrawals: number;
  assetsByWrapper: Record<Wrapper, number>;   // closing balances
  liabilitiesTotal: number; netWorth: number;
  shortfall: boolean;
}

interface PlanProjection {
  years: YearProjection[];
  verdict: {
    feasible: boolean;                         // money lasts to planToAge
    firstShortfallAge: number | null;
    peakNetWorth: { age: number; value: number };
    earliestSustainableRetirementAge: number | null;   // solved by re-running across ages
  };
}

function project(input: PlanInput): PlanProjection;
```

`IncomeKind = "SALARY" | "SELF_EMPLOYMENT" | "STATE_PENSION" | "DB_PENSION" | "RENTAL" | "OTHER"`.
`ExpenseCategory` reuses the existing Prisma enum (`FIXED | VARIABLE | DISCRETIONARY`).

All money is plain `number` (pounds) inside the engine, **rounded to whole pounds in outputs** (decimal
precision is meaningless over a multi-decade projection); `Decimal` ↔ `number` conversion happens at
the persistence boundary (§8).

## 8. Data model (Phase 1 — Prisma)

Follows repo conventions: `uuid` ids, `userId` scoping as the primary authorization boundary
(per ADR-002 — **write both the `userId` filter and an RLS policy** for every new model), `Decimal`
for money, `deletedAt` soft-delete, explicit indexes. One user → **many** `Plan`s (scenarios later);
v1 surfaces the `isPrimary` one.

New enums: `PlanAssetWrapper`, `PlanIncomeKind`, `PlanEventDirection`, `GrowthKind`.
Reuses existing `ExpenseCategory`.

```prisma
model Plan {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @db.Uuid
  name            String
  dateOfBirth     DateTime @db.Date          // drives the age axis
  retirementAge   Int
  planToAge       Int      @default(95)
  inflationPct    Decimal  @default(2.5) @db.Decimal(5, 2)
  // Plan-wide default return %. An asset's own expectedReturnPct overrides it; assets that leave it
  // unset inherit this. Resolution is simply: asset.expectedReturnPct ?? plan.defaultReturnPct.
  // The UI *suggests* a starting return per wrapper at asset-creation (cash low, equities higher),
  // but that is a UX convenience — not a stored resolution layer.
  defaultReturnPct Decimal @default(5) @db.Decimal(5, 2)
  statePensionAge Int?
  statePensionAnnual Decimal? @db.Decimal(12, 2)
  isPrimary       Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  assets      PlanAsset[]
  liabilities PlanLiability[]
  incomes     PlanIncome[]
  expenses    PlanExpense[]
  events      PlanEvent[]

  @@index([userId])
}

model PlanAsset {
  id                String  @id @default(uuid()) @db.Uuid
  planId            String  @db.Uuid
  label             String
  wrapper           PlanAssetWrapper
  openingValue      Decimal @default(0) @db.Decimal(14, 2)
  expectedReturnPct Decimal? @db.Decimal(5, 2)   // null ⇒ plan.defaultReturnPct
  monthlyContribution Decimal @default(0) @db.Decimal(12, 2)
  drawdownPriority  Int     @default(0)
  sourceBalanceItemId String? @db.Uuid           // provenance when seeded; not a live FK
  sortOrder         Int     @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanLiability {
  id              String  @id @default(uuid()) @db.Uuid
  planId          String  @db.Uuid
  label           String
  openingBalance  Decimal @default(0) @db.Decimal(14, 2)
  interestPct     Decimal @default(0) @db.Decimal(5, 2)
  monthlyRepayment Decimal @default(0) @db.Decimal(12, 2)
  endAge          Int?
  linkedAssetId   String? @db.Uuid
  sortOrder       Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanIncome {
  id           String  @id @default(uuid()) @db.Uuid
  planId       String  @db.Uuid
  label        String
  kind         PlanIncomeKind
  annualAmount Decimal @default(0) @db.Decimal(12, 2)
  startAge     Int?
  endAge       Int?
  growthKind   GrowthKind @default(INFLATION)
  growthPct    Decimal?   @db.Decimal(5, 2)      // used when growthKind = FIXED
  taxable      Boolean    @default(true)
  sortOrder    Int        @default(0)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanExpense {
  id              String  @id @default(uuid()) @db.Uuid
  planId          String  @db.Uuid
  label           String
  category        ExpenseCategory?
  annualAmount    Decimal @default(0) @db.Decimal(12, 2)
  startAge        Int?
  endAge          Int?
  inflationLinked Boolean @default(true)
  sourceCategoryId String? @db.Uuid              // provenance when seeded from a Category
  sortOrder       Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

model PlanEvent {
  id        String  @id @default(uuid()) @db.Uuid
  planId    String  @db.Uuid
  label     String
  age       Int
  direction PlanEventDirection
  amount    Decimal @default(0) @db.Decimal(14, 2)
  sortOrder Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}

enum PlanAssetWrapper { PENSION ISA GIA CASH PROPERTY DB_PENSION OTHER }
enum PlanIncomeKind   { SALARY SELF_EMPLOYMENT STATE_PENSION DB_PENSION RENTAL OTHER }
enum PlanEventDirection { INFLOW OUTFLOW }
enum GrowthKind { INFLATION FIXED NONE }
```

`User` gains `plans Plan[]`. Migrations authored **inside the container** only
(`make migrate-create name=add_plan_models`), per the local-vs-prod DB trap in CLAUDE.md.

## 9. Tax seam

The engine takes a `TaxFn` so tax depth can grow without touching the projection loop:

```ts
interface TaxContext {
  age: number;
  taxableIncomeByKind: Partial<Record<IncomeKind, number>>;
  pensionWithdrawal: number;     // for Phase 4: 25% tax-free, rest at marginal
  isaWithdrawal: number;         // tax-free
  giaWithdrawal: number;         // CGT considerations (Phase 4)
  retired: boolean;
}
type TaxFn = (ctx: TaxContext) => number;   // returns total tax for the year
```

- **Phase 0 / v1:** `blendedRateTax` — a single effective rate (a plan-level or constant %) applied to
  taxable income. Crude but lets the engine and charts be correct end-to-end.
- **Phase 4:** `ukSimplifiedTax` — income-tax bands, personal allowance (+ taper), pension tax relief,
  25% tax-free lump sum, state-pension interaction; NI/dividend/CGT approximated. Swapped in with **no
  engine change**, only a new `TaxFn` implementation + tests.

## 10. Open questions / decisions to confirm at review

1. **Range band (uncertainty):** **Confirmed** — v1 ships a single deterministic line. The cheap
   optimistic/pessimistic band (return ± delta) is a later phase; Monte-Carlo deferred indefinitely.
2. **Return resolution** — now `asset.expectedReturnPct ?? plan.defaultReturnPct` (single plan-wide
   default + per-asset override, per your note). Per-wrapper figures are only *suggested* starting
   values at asset-creation, not a stored layer. Confirmed.
3. **Property in net worth but not drawdown** — property is an illiquid asset; v1 excludes it from the
   drawdown waterfall (you can't spend a wall) but counts it in net worth. Downsizing = a `PlanEvent`.
   **Confirmed.**
4. **Event richness** — v1 `PlanEvent` is a simple **single-year** lump inflow/outflow against cash.
   **Confirmed.** Future: events should also support **multi-year duration** (not just one year).
   Recurring multi-year *costs* are already covered by expense/income streams (Gantt bars); `PlanEvent`
   gaining an optional `endAge`/duration for multi-year one-offs is a later phase. House-purchase that
   *creates* a PROPERTY asset + mortgage liability is also a Phase 2 richer event.
5. **Engine money type** — plain `number` inside the engine, **rounded to whole pounds** in outputs
   (sub-penny precision is meaningless over a multi-decade projection); `Decimal` only at the DB
   boundary. **Confirmed.**

## 11. Testing & architecture notes

- **Phase 0** is pure ⇒ exhaustively unit-tested in Jest (`src/lib/plan/*.test.ts`): waterfall
  correctness, shortfall detection, drawdown order, growth/inflation compounding, event application,
  verdict solving. No DB, no mocks.
- **Phase 1** server actions get **integration tests** (`*.int.test.ts`, real `halcyon_test` DB) for
  seeding from Balance/Budget and CRUD, per the repo's integration-test convention.
- Charts are server-rendered first (Phase 1); client-side recompute arrives in Phase 3 by importing the
  *same* pure engine — no logic duplication.
- New models need both the `userId` Prisma filter **and** an RLS policy (ADR-002).

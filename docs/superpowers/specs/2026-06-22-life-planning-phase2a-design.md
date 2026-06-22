# Life Planning — Phase 2a: Editing-completion CRUD

**Date:** 2026-06-22
**Status:** Design — approved for planning
**Predecessors:** Phase 0 engine, 1a read-only `/plan`, 1b editing (#60/#61), 2b charts+switcher (#62)

## 1. Context & goal

Phase 1b made the seeded plan's **assumptions, assets, and liabilities** editable inline, but only their existing fields — there is no way to **add or remove** rows, and **incomes, expenses, and events** have no editing UI at all (they're seeded from the latest month's balance/budget, projected by the engine, but invisible/uneditable). Phase 2a completes the editing surface: full CRUD for all five plan child collections, so a plan is fully buildable by hand rather than only derivable from seeded data. It is also the prerequisite for the 2c life-events Gantt (which manipulates these streams/events).

## 2. Scope & non-goals

**Pure UI + server-action work. No schema or migration changes** — the Prisma models (`PlanAsset`, `PlanLiability`, `PlanIncome`, `PlanExpense`, `PlanEvent`), their `sortOrder`, and soft-delete `deletedAt` already exist; `getPrimaryPlan` already loads all five collections (`deletedAt`-filtered, `sortOrder`-ordered) and the engine already projects them.

In scope:
- **Create** a row in any of the five collections (insert a sensible default, then edit inline).
- **Remove** a row from any collection (soft-delete, with a confirm step).
- **Edit** incomes/expenses/events inline (assets/liabilities already editable from 1b), exposing the **full field set**.

Non-goals (later phases): the life-events Gantt (2c), real-time sliders (3), real UK tax (4), reordering rows by drag (rows stay in `sortOrder`; new rows append).

## 3. Field exposure (full set)

| Collection | Editable fields |
| --- | --- |
| **Asset** (exists) | label, wrapper, openingValue, expectedReturnPct, annualContribution, drawdownPriority |
| **Liability** (exists) | label, openingBalance, interestPct, monthlyRepayment, endAge |
| **Income** (new) | label, kind (`PlanIncomeKind`), annualAmount, startAge?, endAge?, growthKind (`GrowthKind`) + growthPct (only when `FIXED`), taxable |
| **Expense** (new) | label, category (`ExpenseCategory`), annualAmount, startAge?, endAge?, inflationLinked |
| **Event** (new) | label, age, direction (`PlanEventDirection`), amount |

Enums (from schema): `PlanIncomeKind = SALARY|SELF_EMPLOYMENT|STATE_PENSION|DB_PENSION|RENTAL|OTHER`; `GrowthKind = INFLATION|FIXED|NONE`; `ExpenseCategory = FIXED|VARIABLE|DISCRETIONARY`; `PlanEventDirection = INFLOW|OUTFLOW`; `PlanAssetWrapper` as in 2b.

`startAge`/`endAge` and `expectedReturnPct` are nullable → `NumberCell nullable`. **Expense `category` is nullable in the schema** (seeded rows can carry null); the UI always presents a concrete value: serialize `category ?? "FIXED"`, edit via a `SelectCell` over `[FIXED, VARIABLE, DISCRETIONARY]`, and write a non-null category on save. (A seeded null-category expense therefore reads as FIXED and is persisted as FIXED on its first edit — acceptable; null only ever meant the engine's fallback bucket.)

## 4. Server actions (`src/app/plan/actions.ts`)

All ownership-scoped server-side, following the established idiom (`requireUserId()` → zod parse → scoped Prisma write → `revalidatePath("/plan")`; client editors additionally call `router.refresh()` so the server-rendered chart/verdict recompute — the 1b-closeout convention).

### Create — `createPlan<Asset|Liability|Income|Expense|Event>()`
Takes **no client-supplied plan id**. Resolves the authed user's primary plan server-side, then inserts one default row:

```ts
export async function createPlanIncome(): Promise<void> {
  const userId = await requireUserId();
  const plan = await prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    select: { id: true },
  });
  if (!plan) throw new Error("Plan not found");
  const max = await prisma.planIncome.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planIncome.create({
    data: { planId: plan.id, label: "New income", kind: "OTHER",
            annualAmount: 0, growthKind: "INFLATION", taxable: true,
            sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/plan");
}
```

Defaults per collection: Asset `{label:"New asset", wrapper:"OTHER", openingValue:0, annualContribution:0, drawdownPriority:0}`; Liability `{label:"New liability", openingBalance:0, interestPct:0, monthlyRepayment:0}`; Income as above; Expense `{label:"New expense", category:"FIXED", annualAmount:0, inflationLinked:true}`; Event `{label:"New event", age: <plan.retirementAge>, direction:"OUTFLOW", amount:0}`.

### Delete (soft) — `deletePlan<…>(input: { id })`
```ts
const res = await prisma.planIncome.updateMany({
  where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
  data: { deletedAt: new Date() },
});
if (res.count === 0) throw new Error("Income not found");
revalidatePath("/plan");
```
(`new Date()` is allowed here — server action, not a workflow script.)

### Update — `updatePlan<Income|Expense|Event>(input)`
Mirror `updatePlanAsset` exactly: zod-parsed, `updateMany({ where: { id, deletedAt: null, plan: { userId, deletedAt: null } }, data }), throw on count 0, revalidate.

## 5. Schemas (`src/lib/plan/schemas.ts`)

Add `updatePlanIncomeSchema`, `updatePlanExpenseSchema`, `updatePlanEventSchema` (+ inferred `Update…Input` types) and a small `deleteRowSchema = z.object({ id: z.string().uuid() })` shared by the delete actions. Income's growth: `growthKind: z.enum(["INFLATION","FIXED","NONE"])` + `growthPct: z.number().nullable()` (only meaningful when `FIXED`; engine ignores it otherwise). Ages: `z.number().int().nullable()`. Amounts: `z.number().min(0)` (matches existing min(0) convention).

## 6. Serialized types & page (`serialized.ts`, `page.tsx`)

Add `SerializedPlanIncome`/`Expense`/`Event` and extend `SerializedPlan`. `page.tsx` maps the already-loaded `plan.incomes/expenses/events` (Decimal → number, enums → string, dates n/a). Existing assumptions/assets/liabilities mapping unchanged.

## 7. UI components (`src/app/plan/`)

- **New:** `IncomesTable.tsx`, `ExpensesTable.tsx`, `EventsTable.tsx` — mirror `AssetsTable`/`LiabilitiesTable`: one inline-editable row per record using `EditableCell` (`NumberCell`/`SelectCell`/`TextCell`), a per-row **Remove** control, and an **Add** button below the table. Each row's `save` calls the matching `updatePlan…` then `router.refresh()` (1b pattern); Add calls `createPlan…` then refresh; Remove calls `deletePlan…` then refresh.
- **Edited:** `AssetsTable`/`LiabilitiesTable` gain the same **Add** + per-row **Remove**. All five tables **always render** (so Add is reachable when empty) with an empty hint row; `LiabilitiesTable`'s current "return null when empty" is removed.
- **Remove UX (confirm-first):** a small shared `RemoveCell` — Remove → swaps in an inline "Remove? · yes / cancel" (no native `confirm()`); "yes" calls the delete action. Local component state, reverts on cancel.
- **Income growth conditional:** `SelectCell` for `growthKind`; a `NumberCell` for `growthPct` rendered only when `growthKind === "FIXED"` (otherwise a dash/empty cell).
- **`PlanView`** renders, in order: Assumptions, Assets, Liabilities, Incomes, Expenses, Events (each below the chart panel).
- Keep components small and single-purpose (one table per file); factor the Add/Remove controls into a tiny shared module to stay DRY across five tables.

## 8. Error handling

Same as 1b: each action throws on ownership-miss (`count === 0`); the client `save`/`remove`/`add` wrappers catch, show an inline error, and (for edits) revert the cell. zod rejects malformed input at the action boundary.

## 9. Testing

- **Integration (`src/__tests__/plan/*.int.test.ts`)**, mirroring `updateActions.int.test.ts`:
  - create inserts a default row on the authed user's primary plan with `sortOrder = max+1`;
  - delete soft-deletes (sets `deletedAt`, row disappears from `getPrimaryPlan`) and is **ownership-scoped** — deleting another user's row throws / affects 0 rows;
  - update for income/expense/event round-trips and is ownership-scoped.
- **E2E (`e2e/plan.spec.ts` or a new spec):** add an income → edit a field → confirm-remove it; add then remove an asset. Light coverage; the inline-edit mechanics are already covered by 1b's e2e.
- Chart components / Recharts: unchanged, no new chart tests.

## 10. Decomposition

One spec, one implementation plan. The plan's tasks split naturally: (1) schemas + serialized types, (2) create/delete/update actions + int tests, (3) shared Add/Remove + RemoveCell controls, (4) Incomes table, (5) Expenses table (with growth-conditional handled in 4's shared cells), (6) Events table, (7) Add/Remove on Assets/Liabilities + PlanView wiring, (8) e2e. Each is independently testable; the per-collection tables repeat one reviewed pattern.

## 11. Risks

- **Five near-identical tables** → duplication. Mitigation: shared Add/Remove controls and the existing `EditableCell`s; accept that each table's column set differs enough to warrant its own file (clarity over a generic mega-table).
- **Growth conditional field** is the only non-uniform cell; isolate it so it doesn't complicate the others.
- **Empty plan** (all collections removable) — the engine already handles no-assets via a synthetic CASH pot (verified in 2b); no-income/no-expense project to zero. Tables render their empty hint + Add.

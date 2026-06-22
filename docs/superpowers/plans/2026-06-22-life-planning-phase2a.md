# Life Planning Phase 2a — Editing-completion CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `/plan` fully hand-buildable — add/remove rows for all five plan child collections and edit incomes/expenses/events inline (assets/liabilities already editable from 1b).

**Architecture:** Pure UI + server-action work over models that already exist and are already projected. New ownership-scoped create/delete/update server actions, three new inline-editable tables, shared Add/Remove controls, and serialization — all following the established 1b editor pattern (zod-validated action → `revalidatePath` + client `router.refresh()`; soft-delete via `deletedAt`).

**Tech Stack:** Next.js 16 App Router / React 19, TypeScript, Prisma 7 (Postgres), zod, styled-components, Jest (unit + `*.int.test.ts`), Playwright (e2e), Biome, pnpm.

## Global Constraints

- **No schema or migration changes.** Every Prisma model (`PlanAsset/Liability/Income/Expense/Event`), `sortOrder`, and soft-delete `deletedAt` already exists.
- **Biome bans non-null assertions (`!`).** Never write `x!`.
- **TypeScript:** prefer `satisfies` over `as`; no enums (string-literal unions).
- **Create actions take NO client-supplied plan id** — resolve the authed user's primary plan server-side.
- **Delete is soft** — set `deletedAt: new Date()`, ownership-scoped via `updateMany({ where: { id, plan: { userId } } })`, throw on `count === 0`.
- **Remove UX is confirm-first** — an inline "Remove? · yes / cancel" (no native `confirm()`).
- **Edit/refresh convention:** every mutating action is followed by `router.refresh()` in the client component so the server re-runs the engine and the chart/verdict recompute (the 1b-closeout rule). `revalidatePath("/plan")` stays in the action too.
- **Full field set** exposed per the spec §3 (incl. expense `category ?? "FIXED"`).
- Integration tests run against `halcyon_test` (`pnpm test:int`), which requires the local Docker `db` up (`docker compose up -d db`).
- **Commit trailer** (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Spec: `docs/superpowers/specs/2026-06-22-life-planning-phase2a-design.md`.

---

### Task 1: Data contract — schemas, serialized types, page mapping

**Files:**
- Modify: `src/lib/plan/schemas.ts`
- Modify: `src/app/plan/serialized.ts`
- Modify: `src/app/plan/page.tsx`

**Interfaces:**
- Produces (schemas): `updatePlanIncomeSchema`, `updatePlanExpenseSchema`, `updatePlanEventSchema`, `deleteRowSchema`, and inferred types `UpdatePlanIncomeInput`, `UpdatePlanExpenseInput`, `UpdatePlanEventInput`.
- Produces (serialized): `GrowthKind`, `EventDirection`, `SerializedPlanIncome`, `SerializedPlanExpense`, `SerializedPlanEvent`; `SerializedPlan` gains `incomes`/`expenses`/`events` arrays.

- [ ] **Step 1: Add the zod schemas**

Append to `src/lib/plan/schemas.ts` (the file already imports `z` and defines the `WRAPPER` enum + the asset/liability/assumptions schemas):

```ts
const INCOME_KIND = z.enum([
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
]);
const GROWTH_KIND = z.enum(["INFLATION", "FIXED", "NONE"]);
const EXPENSE_CATEGORY = z.enum(["FIXED", "VARIABLE", "DISCRETIONARY"]);
const EVENT_DIRECTION = z.enum(["INFLOW", "OUTFLOW"]);

export const updatePlanIncomeSchema = z.object({
  incomeId: z.string().uuid(),
  label: z.string().min(1),
  kind: INCOME_KIND,
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120).nullable(),
  endAge: z.number().int().min(0).max(120).nullable(),
  growthKind: GROWTH_KIND,
  growthPct: z.number().min(-20).max(30).nullable(),
  taxable: z.boolean(),
});

export const updatePlanExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  label: z.string().min(1),
  category: EXPENSE_CATEGORY,
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120).nullable(),
  endAge: z.number().int().min(0).max(120).nullable(),
  inflationLinked: z.boolean(),
});

export const updatePlanEventSchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().min(1),
  age: z.number().int().min(0).max(120),
  direction: EVENT_DIRECTION,
  amount: z.number().min(0),
});

export const deleteRowSchema = z.object({ id: z.string().uuid() });

export type UpdatePlanIncomeInput = z.infer<typeof updatePlanIncomeSchema>;
export type UpdatePlanExpenseInput = z.infer<typeof updatePlanExpenseSchema>;
export type UpdatePlanEventInput = z.infer<typeof updatePlanEventSchema>;
```

- [ ] **Step 2: Add the serialized types**

In `src/app/plan/serialized.ts` (currently imports `Wrapper` from `@/lib/plan` and defines `SerializedPlanAssumptions/Asset/Liability` + `SerializedPlan`), change the import and append the new types:

```ts
import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan";

export type GrowthKind = "INFLATION" | "FIXED" | "NONE";
export type EventDirection = "INFLOW" | "OUTFLOW";

export type SerializedPlanIncome = {
  id: string;
  label: string;
  kind: IncomeKind;
  annualAmount: number;
  startAge: number | null;
  endAge: number | null;
  growthKind: GrowthKind;
  growthPct: number | null;
  taxable: boolean;
};

export type SerializedPlanExpense = {
  id: string;
  label: string;
  category: ExpenseCategory;
  annualAmount: number;
  startAge: number | null;
  endAge: number | null;
  inflationLinked: boolean;
};

export type SerializedPlanEvent = {
  id: string;
  label: string;
  age: number;
  direction: EventDirection;
  amount: number;
};
```

Then extend `SerializedPlan`:

```ts
export type SerializedPlan = {
  assumptions: SerializedPlanAssumptions;
  assets: SerializedPlanAsset[];
  liabilities: SerializedPlanLiability[];
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  events: SerializedPlanEvent[];
};
```

- [ ] **Step 3: Map the new collections in `page.tsx`**

In `src/app/plan/page.tsx`, inside the `serialized` object literal (after the existing `liabilities:` mapping), add:

```ts
    incomes: plan.incomes.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      annualAmount: Number(i.annualAmount),
      startAge: i.startAge,
      endAge: i.endAge,
      growthKind: i.growthKind,
      growthPct: i.growthPct === null ? null : Number(i.growthPct),
      taxable: i.taxable,
    })),
    expenses: plan.expenses.map((e) => ({
      id: e.id,
      label: e.label,
      category: e.category ?? "FIXED",
      annualAmount: Number(e.annualAmount),
      startAge: e.startAge,
      endAge: e.endAge,
      inflationLinked: e.inflationLinked,
    })),
    events: plan.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      amount: Number(ev.amount),
    })),
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (`plan.incomes` etc. are already loaded by `getPrimaryPlan`; Prisma enum values are assignable to the string-literal unions.)

- [ ] **Step 5: Run the unit suite (no regressions)**

Run: `pnpm test`
Expected: all suites pass (no behavioural change yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/schemas.ts src/app/plan/serialized.ts src/app/plan/page.tsx
git commit -m "feat(plan): schemas + serialized types for income/expense/event editing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create + delete server actions (all five collections)

**Files:**
- Modify: `src/app/plan/actions.ts`
- Test: `src/__tests__/plan/crudActions.int.test.ts` (create)

**Interfaces:**
- Consumes: `deleteRowSchema` (Task 1); existing `requireUserId`, `prisma`, `revalidatePath`.
- Produces: `createPlanAsset()`, `createPlanLiability()`, `createPlanIncome()`, `createPlanExpense()`, `createPlanEvent()` (all `(): Promise<void>`); `deletePlanAsset/Liability/Income/Expense/Event(input: { id: string }): Promise<void>`.

- [ ] **Step 1: Write the failing integration tests**

Create `src/__tests__/plan/crudActions.int.test.ts`:

```ts
import {
  createPlanEvent,
  createPlanExpense,
  createPlanIncome,
  deletePlanIncome,
} from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function makePrimaryPlan(userId: string) {
  return prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      isPrimary: true,
    },
  });
}

describe("plan create/delete actions (integration)", () => {
  it("createPlanIncome inserts a default row on the owner's primary plan", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanIncome();
    const incomes = await prisma.planIncome.findMany({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.label).toBe("New income");
    expect(incomes[0]?.sortOrder).toBe(0);
  });

  it("createPlanIncome appends with an incrementing sortOrder", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanIncome();
    await createPlanIncome();
    const orders = (
      await prisma.planIncome.findMany({
        where: { plan: { userId: TEST_USER_ID } },
        orderBy: { sortOrder: "asc" },
      })
    ).map((i) => i.sortOrder);
    expect(orders).toEqual([0, 1]);
  });

  it("createPlanExpense defaults category to FIXED", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanExpense();
    const e = await prisma.planExpense.findFirstOrThrow({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(e.category).toBe("FIXED");
  });

  it("createPlanEvent defaults age to the plan's retirement age", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanEvent();
    const ev = await prisma.planEvent.findFirstOrThrow({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(ev.age).toBe(65);
  });

  it("create throws when the user has no primary plan", async () => {
    await expect(createPlanIncome()).rejects.toThrow();
  });

  it("deletePlanIncome soft-deletes for the owner", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: { create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }] },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await deletePlanIncome({ id });
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.deletedAt).not.toBeNull();
  });

  it("rejects deleting another user's income (no cross-user delete)", async () => {
    const other = await prisma.user.create({
      data: { id: "99999999-9999-9999-9999-999999999999" },
    });
    const plan = await prisma.plan.create({
      data: {
        userId: other.id,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: { create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }] },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await expect(deletePlanIncome({ id })).rejects.toThrow();
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.deletedAt).toBeNull(); // unchanged
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

First ensure the DB is up: `docker compose up -d db`
Run: `pnpm test:int -- crudActions`
Expected: FAIL — `createPlanIncome is not a function` (not yet exported).

- [ ] **Step 3: Add the create + delete actions**

In `src/app/plan/actions.ts`, add the `deleteRowSchema` import to the existing `@/lib/plan/schemas` import block, then append a helper and the actions:

```ts
async function requirePrimaryPlan(userId: string) {
  const plan = await prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    select: { id: true, retirementAge: true },
  });
  if (!plan) throw new Error("Plan not found");
  return plan;
}

export async function createPlanAsset(): Promise<void> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planAsset.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "New asset",
      wrapper: "OTHER",
      openingValue: 0,
      annualContribution: 0,
      drawdownPriority: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

export async function createPlanLiability(): Promise<void> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planLiability.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planLiability.create({
    data: {
      planId: plan.id,
      label: "New liability",
      openingBalance: 0,
      interestPct: 0,
      monthlyRepayment: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

export async function createPlanIncome(): Promise<void> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planIncome.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planIncome.create({
    data: {
      planId: plan.id,
      label: "New income",
      kind: "OTHER",
      annualAmount: 0,
      growthKind: "INFLATION",
      taxable: true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

export async function createPlanExpense(): Promise<void> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planExpense.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planExpense.create({
    data: {
      planId: plan.id,
      label: "New expense",
      category: "FIXED",
      annualAmount: 0,
      inflationLinked: true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

export async function createPlanEvent(): Promise<void> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planEvent.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  await prisma.planEvent.create({
    data: {
      planId: plan.id,
      label: "New event",
      age: plan.retirementAge,
      direction: "OUTFLOW",
      amount: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

export async function deletePlanAsset(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planAsset.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Asset not found");
  revalidatePath("/plan");
}

export async function deletePlanLiability(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planLiability.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Liability not found");
  revalidatePath("/plan");
}

export async function deletePlanIncome(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planIncome.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Income not found");
  revalidatePath("/plan");
}

export async function deletePlanExpense(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planExpense.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Expense not found");
  revalidatePath("/plan");
}

export async function deletePlanEvent(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planEvent.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Event not found");
  revalidatePath("/plan");
}
```

Update the schemas import at the top of `actions.ts` to include `deleteRowSchema`:

```ts
import {
  type UpdatePlanAssetInput,
  type UpdatePlanAssumptionsInput,
  type UpdatePlanLiabilityInput,
  deleteRowSchema,
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanLiabilitySchema,
} from "@/lib/plan/schemas";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:int -- crudActions`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/actions.ts src/__tests__/plan/crudActions.int.test.ts
git commit -m "feat(plan): create + soft-delete actions for all plan collections

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Update actions for income / expense / event

**Files:**
- Modify: `src/app/plan/actions.ts`
- Test: `src/__tests__/plan/crudActions.int.test.ts` (extend)

**Interfaces:**
- Consumes: `updatePlanIncomeSchema/ExpenseSchema/EventSchema` + their input types (Task 1).
- Produces: `updatePlanIncome(input: UpdatePlanIncomeInput)`, `updatePlanExpense(input: UpdatePlanExpenseInput)`, `updatePlanEvent(input: UpdatePlanEventInput)` — all `Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/plan/crudActions.int.test.ts` (add the three update fns to the existing `@/app/plan/actions` import):

```ts
describe("plan update actions for income/expense/event (integration)", () => {
  it("updatePlanIncome round-trips for the owner", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: { create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }] },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await updatePlanIncome({
      incomeId: id,
      label: "Rent",
      kind: "RENTAL",
      annualAmount: 12000,
      startAge: 60,
      endAge: 90,
      growthKind: "FIXED",
      growthPct: 3,
      taxable: false,
    });
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.kind).toBe("RENTAL");
    expect(Number(after.annualAmount)).toBe(12000);
    expect(after.taxable).toBe(false);
    expect(Number(after.growthPct)).toBe(3);
  });

  it("rejects updating another user's income", async () => {
    const other = await prisma.user.create({
      data: { id: "88888888-8888-8888-8888-888888888888" },
    });
    const plan = await prisma.plan.create({
      data: {
        userId: other.id,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: { create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }] },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await expect(
      updatePlanIncome({
        incomeId: id,
        label: "hacked",
        kind: "OTHER",
        annualAmount: 0,
        startAge: null,
        endAge: null,
        growthKind: "NONE",
        growthPct: null,
        taxable: true,
      }),
    ).rejects.toThrow();
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.label).toBe("Salary");
  });

  it("updatePlanExpense and updatePlanEvent round-trip", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        expenses: { create: [{ label: "Food", category: "FIXED", annualAmount: 5000 }] },
        events: { create: [{ label: "Car", age: 70, direction: "OUTFLOW", amount: 20000 }] },
      },
      include: { expenses: true, events: true },
    });
    await updatePlanExpense({
      expenseId: plan.expenses[0]?.id ?? "",
      label: "Groceries",
      category: "VARIABLE",
      annualAmount: 6000,
      startAge: null,
      endAge: null,
      inflationLinked: false,
    });
    await updatePlanEvent({
      eventId: plan.events[0]?.id ?? "",
      label: "New car",
      age: 72,
      direction: "OUTFLOW",
      amount: 25000,
    });
    const e = await prisma.planExpense.findUniqueOrThrow({
      where: { id: plan.expenses[0]?.id ?? "" },
    });
    const ev = await prisma.planEvent.findUniqueOrThrow({
      where: { id: plan.events[0]?.id ?? "" },
    });
    expect(e.category).toBe("VARIABLE");
    expect(e.inflationLinked).toBe(false);
    expect(ev.age).toBe(72);
    expect(Number(ev.amount)).toBe(25000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:int -- crudActions`
Expected: FAIL — `updatePlanIncome is not a function`.

- [ ] **Step 3: Add the update actions**

In `src/app/plan/actions.ts`, add the three new schema imports/types to the `@/lib/plan/schemas` import block (`updatePlanIncomeSchema`, `updatePlanExpenseSchema`, `updatePlanEventSchema`, and types `UpdatePlanIncomeInput`, `UpdatePlanExpenseInput`, `UpdatePlanEventInput`), then append:

```ts
export async function updatePlanIncome(
  input: UpdatePlanIncomeInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanIncomeSchema.parse(input);
  const res = await prisma.planIncome.updateMany({
    where: { id: p.incomeId, deletedAt: null, plan: { userId, deletedAt: null } },
    data: {
      label: p.label,
      kind: p.kind,
      annualAmount: p.annualAmount,
      startAge: p.startAge,
      endAge: p.endAge,
      growthKind: p.growthKind,
      growthPct: p.growthPct,
      taxable: p.taxable,
    },
  });
  if (res.count === 0) throw new Error("Income not found");
  revalidatePath("/plan");
}

export async function updatePlanExpense(
  input: UpdatePlanExpenseInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanExpenseSchema.parse(input);
  const res = await prisma.planExpense.updateMany({
    where: { id: p.expenseId, deletedAt: null, plan: { userId, deletedAt: null } },
    data: {
      label: p.label,
      category: p.category,
      annualAmount: p.annualAmount,
      startAge: p.startAge,
      endAge: p.endAge,
      inflationLinked: p.inflationLinked,
    },
  });
  if (res.count === 0) throw new Error("Expense not found");
  revalidatePath("/plan");
}

export async function updatePlanEvent(
  input: UpdatePlanEventInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanEventSchema.parse(input);
  const res = await prisma.planEvent.updateMany({
    where: { id: p.eventId, deletedAt: null, plan: { userId, deletedAt: null } },
    data: {
      label: p.label,
      age: p.age,
      direction: p.direction,
      amount: p.amount,
    },
  });
  if (res.count === 0) throw new Error("Event not found");
  revalidatePath("/plan");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test:int -- crudActions`
Expected: PASS (all create/delete/update tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/actions.ts src/__tests__/plan/crudActions.int.test.ts
git commit -m "feat(plan): update actions for income/expense/event

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Shared row controls + boolean cell

**Files:**
- Create: `src/app/plan/RowControls.tsx`
- Create: `src/app/plan/RowControls.test.tsx`
- Modify: `src/app/plan/EditableCell.tsx` (add `BoolCell`)

**Interfaces:**
- Produces: `AddRowButton({ label, onAdd })`, `RemoveCell({ onConfirm })` from `./RowControls`; `BoolCell({ value, onCommit })` from `./EditableCell`.

- [ ] **Step 1: Write the failing RTL test for RemoveCell**

Create `src/app/plan/RowControls.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { theme } from "@/lib/theme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { RemoveCell } from "./RowControls";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("RemoveCell", () => {
  it("requires confirmation before calling onConfirm", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(<RemoveCell onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /yes/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("cancel aborts and restores the Remove button", () => {
    const onConfirm = jest.fn();
    renderWithTheme(<RemoveCell onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- RowControls`
Expected: FAIL — cannot find module `./RowControls`.

- [ ] **Step 3: Implement RowControls**

Create `src/app/plan/RowControls.tsx`:

```tsx
// src/app/plan/RowControls.tsx
"use client";

import { useState } from "react";
import styled from "styled-components";

const LinkBtn = styled.button`
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  padding: 0;
  text-decoration: underline;
`;
const AddBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  width: fit-content;
`;
const Confirm = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: center;
`;

export function AddRowButton({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      await onAdd();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AddBtn type="button" onClick={add} disabled={busy}>
      + {label}
    </AddBtn>
  );
}

export function RemoveCell({
  onConfirm,
}: {
  onConfirm: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <LinkBtn type="button" onClick={() => setConfirming(true)}>
        Remove
      </LinkBtn>
    );
  }

  const yes = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Confirm>
      Remove?
      <LinkBtn type="button" onClick={yes} disabled={busy}>
        yes
      </LinkBtn>
      /
      <LinkBtn type="button" onClick={() => setConfirming(false)} disabled={busy}>
        cancel
      </LinkBtn>
    </Confirm>
  );
}
```

- [ ] **Step 4: Add `BoolCell` to EditableCell**

Append to `src/app/plan/EditableCell.tsx`:

```tsx
export function BoolCell({
  value,
  onCommit,
}: {
  value: boolean;
  onCommit: (value: boolean) => Promise<void> | void;
}) {
  // Fully controlled by `value`: on a successful save the committed prop
  // re-renders the box; on a rejected save the row's `setError` re-render
  // restores the old `value`, reverting it. We catch here so the rejected
  // save (which the row rethrows so cells can revert) isn't an unhandled
  // promise rejection — the row already surfaces the error message.
  const handle = async (checked: boolean) => {
    try {
      await onCommit(checked);
    } catch {
      // row shows the error; controlled `value` reverts on the next render
    }
  };
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => handle(e.target.checked)}
    />
  );
}
```

- [ ] **Step 5: Run RTL test + typecheck/lint**

Run: `pnpm test -- RowControls`
Expected: PASS (2 tests).
Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/RowControls.tsx src/app/plan/RowControls.test.tsx src/app/plan/EditableCell.tsx
git commit -m "feat(plan): shared Add/Remove (confirm-first) controls + BoolCell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Incomes table + PlanView wiring

**Files:**
- Create: `src/app/plan/IncomesTable.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `NumberCell`, `SelectCell`, `TextCell`, `BoolCell` (`./EditableCell`); `AddRowButton`, `RemoveCell` (`./RowControls`); `createPlanIncome`, `deletePlanIncome`, `updatePlanIncome` (`./actions`); `SerializedPlanIncome`, `GrowthKind` (`./serialized`); `IncomeKind` (`@/lib/plan`).
- Produces: `IncomesTable({ incomes }: { incomes: SerializedPlanIncome[] })`.

- [ ] **Step 1: Create IncomesTable**

Create `src/app/plan/IncomesTable.tsx`:

```tsx
// src/app/plan/IncomesTable.tsx
"use client";

import type { IncomeKind } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import { createPlanIncome, deletePlanIncome, updatePlanIncome } from "./actions";
import type { GrowthKind, SerializedPlanIncome } from "./serialized";

const INCOME_KINDS: IncomeKind[] = [
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
];
const GROWTH_KINDS: GrowthKind[] = ["INFLATION", "FIXED", "NONE"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.xs}; font-size: 13px; }
  th { color: ${({ theme }) => theme.colors.dim}; font-weight: 500; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;
const Empty = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
`;
const Dash = styled.span`
  color: ${({ theme }) => theme.colors.dim};
`;

function IncomeRow({ income }: { income: SerializedPlanIncome }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanIncome) => {
    setError(null);
    try {
      await updatePlanIncome({
        incomeId: next.id,
        label: next.label,
        kind: next.kind,
        annualAmount: next.annualAmount,
        startAge: next.startAge,
        endAge: next.endAge,
        growthKind: next.growthKind,
        growthPct: next.growthPct,
        taxable: next.taxable,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deletePlanIncome({ id: income.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };

  return (
    <>
      <tr>
        <td>
          <TextCell value={income.label} onCommit={(v) => save({ ...income, label: v })} />
        </td>
        <td>
          <SelectCell
            value={income.kind}
            options={INCOME_KINDS}
            onCommit={(v) => save({ ...income, kind: v })}
          />
        </td>
        <td>
          <NumberCell
            value={income.annualAmount}
            onCommit={(v) => save({ ...income, annualAmount: v ?? income.annualAmount })}
          />
        </td>
        <td>
          <NumberCell
            value={income.startAge}
            nullable
            onCommit={(v) => save({ ...income, startAge: v })}
          />
        </td>
        <td>
          <NumberCell
            value={income.endAge}
            nullable
            onCommit={(v) => save({ ...income, endAge: v })}
          />
        </td>
        <td>
          <SelectCell
            value={income.growthKind}
            options={GROWTH_KINDS}
            onCommit={(v) => save({ ...income, growthKind: v })}
          />
        </td>
        <td>
          {income.growthKind === "FIXED" ? (
            <NumberCell
              value={income.growthPct}
              nullable
              step="0.1"
              onCommit={(v) => save({ ...income, growthPct: v })}
            />
          ) : (
            <Dash>—</Dash>
          )}
        </td>
        <td>
          <BoolCell value={income.taxable} onCommit={(v) => save({ ...income, taxable: v })} />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={9}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function IncomesTable({ incomes }: { incomes: SerializedPlanIncome[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanIncome();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Income</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Kind</th>
            <th>Amount /yr</th>
            <th>Start age</th>
            <th>End age</th>
            <th>Growth</th>
            <th>Growth %</th>
            <th>Taxable</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {incomes.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <Empty>No income yet.</Empty>
              </td>
            </tr>
          ) : (
            incomes.map((i) => <IncomeRow key={i.id} income={i} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add income" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 2: Wire into PlanView**

In `src/app/plan/PlanView.tsx`: add `import { IncomesTable } from "./IncomesTable";`, and render it after `<LiabilitiesTable … />`:

```tsx
      <IncomesTable incomes={plan.incomes} />
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (`SelectCell<IncomeKind>` and `SelectCell<GrowthKind>` type-check because the option arrays are typed to those unions and the serialized fields use the same unions.)

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/IncomesTable.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): income table with inline edit + add/remove

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Expenses table + Events table + PlanView wiring

**Files:**
- Create: `src/app/plan/ExpensesTable.tsx`
- Create: `src/app/plan/EventsTable.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: same cells/controls/actions as Task 5, plus `createPlanExpense/deletePlanExpense/updatePlanExpense`, `createPlanEvent/deletePlanEvent/updatePlanEvent`; `SerializedPlanExpense`, `SerializedPlanEvent`, `EventDirection` (`./serialized`); `ExpenseCategory` (`@/lib/plan`).
- Produces: `ExpensesTable({ expenses })`, `EventsTable({ events })`.

- [ ] **Step 1: Create ExpensesTable**

Create `src/app/plan/ExpensesTable.tsx`:

```tsx
// src/app/plan/ExpensesTable.tsx
"use client";

import type { ExpenseCategory } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import {
  createPlanExpense,
  deletePlanExpense,
  updatePlanExpense,
} from "./actions";
import type { SerializedPlanExpense } from "./serialized";

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["FIXED", "VARIABLE", "DISCRETIONARY"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.xs}; font-size: 13px; }
  th { color: ${({ theme }) => theme.colors.dim}; font-weight: 500; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;
const Empty = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
`;

function ExpenseRow({ expense }: { expense: SerializedPlanExpense }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanExpense) => {
    setError(null);
    try {
      await updatePlanExpense({
        expenseId: next.id,
        label: next.label,
        category: next.category,
        annualAmount: next.annualAmount,
        startAge: next.startAge,
        endAge: next.endAge,
        inflationLinked: next.inflationLinked,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deletePlanExpense({ id: expense.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };

  return (
    <>
      <tr>
        <td>
          <TextCell value={expense.label} onCommit={(v) => save({ ...expense, label: v })} />
        </td>
        <td>
          <SelectCell
            value={expense.category}
            options={EXPENSE_CATEGORIES}
            onCommit={(v) => save({ ...expense, category: v })}
          />
        </td>
        <td>
          <NumberCell
            value={expense.annualAmount}
            onCommit={(v) => save({ ...expense, annualAmount: v ?? expense.annualAmount })}
          />
        </td>
        <td>
          <NumberCell
            value={expense.startAge}
            nullable
            onCommit={(v) => save({ ...expense, startAge: v })}
          />
        </td>
        <td>
          <NumberCell
            value={expense.endAge}
            nullable
            onCommit={(v) => save({ ...expense, endAge: v })}
          />
        </td>
        <td>
          <BoolCell
            value={expense.inflationLinked}
            onCommit={(v) => save({ ...expense, inflationLinked: v })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={7}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ExpensesTable({ expenses }: { expenses: SerializedPlanExpense[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanExpense();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>Expenses</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Category</th>
            <th>Amount /yr</th>
            <th>Start age</th>
            <th>End age</th>
            <th>Inflation-linked</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <Empty>No expenses yet.</Empty>
              </td>
            </tr>
          ) : (
            expenses.map((e) => <ExpenseRow key={e.id} expense={e} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add expense" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 2: Create EventsTable**

Create `src/app/plan/EventsTable.tsx`:

```tsx
// src/app/plan/EventsTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import { createPlanEvent, deletePlanEvent, updatePlanEvent } from "./actions";
import type { EventDirection, SerializedPlanEvent } from "./serialized";

const DIRECTIONS: EventDirection[] = ["INFLOW", "OUTFLOW"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.xs}; font-size: 13px; }
  th { color: ${({ theme }) => theme.colors.dim}; font-weight: 500; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;
const Empty = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
`;

function EventRow({ event }: { event: SerializedPlanEvent }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanEvent) => {
    setError(null);
    try {
      await updatePlanEvent({
        eventId: next.id,
        label: next.label,
        age: next.age,
        direction: next.direction,
        amount: next.amount,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deletePlanEvent({ id: event.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };

  return (
    <>
      <tr>
        <td>
          <TextCell value={event.label} onCommit={(v) => save({ ...event, label: v })} />
        </td>
        <td>
          <NumberCell value={event.age} onCommit={(v) => save({ ...event, age: v ?? event.age })} />
        </td>
        <td>
          <SelectCell
            value={event.direction}
            options={DIRECTIONS}
            onCommit={(v) => save({ ...event, direction: v })}
          />
        </td>
        <td>
          <NumberCell
            value={event.amount}
            onCommit={(v) => save({ ...event, amount: v ?? event.amount })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={5}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function EventsTable({ events }: { events: SerializedPlanEvent[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanEvent();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>One-off events</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Age</th>
            <th>Direction</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <Empty>No events yet.</Empty>
              </td>
            </tr>
          ) : (
            events.map((ev) => <EventRow key={ev.id} event={ev} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add event" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 3: Wire both into PlanView**

In `src/app/plan/PlanView.tsx`: add imports for `ExpensesTable` and `EventsTable`, and render them after `<IncomesTable … />`:

```tsx
      <ExpensesTable expenses={plan.expenses} />
      <EventsTable events={plan.events} />
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/ExpensesTable.tsx src/app/plan/EventsTable.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): expenses + events tables with inline edit + add/remove

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add/Remove on Assets & Liabilities tables

**Files:**
- Modify: `src/app/plan/AssetsTable.tsx`
- Modify: `src/app/plan/LiabilitiesTable.tsx`

**Interfaces:**
- Consumes: `AddRowButton`, `RemoveCell` (`./RowControls`); `createPlanAsset/deletePlanAsset`, `createPlanLiability/deletePlanLiability` (`./actions`).

- [ ] **Step 1: AssetsTable — add Remove column + Add button**

In `src/app/plan/AssetsTable.tsx`:

1. Extend the actions import: `import { createPlanAsset, deletePlanAsset, updatePlanAsset } from "./actions";`
2. Add: `import { AddRowButton, RemoveCell } from "./RowControls";`
3. In `AssetRow`, add a `remove` handler next to `save`:

```tsx
  const remove = async () => {
    setError(null);
    try {
      await deletePlanAsset({ id: asset.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };
```

4. Add a final cell to the row (after the drawdown-order cell, before the closing `</tr>`):

```tsx
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
```

5. Bump the error row `colSpan` from `6` to `7`.
6. Add a header `<th></th>` as the last column in `<thead>`.
7. In the `AssetsTable` export, make it a router-aware add. Add `import { useRouter } from "next/navigation";` if not present (it is, via AssetRow — but the table component needs its own). Wrap the table with an add button:

```tsx
export function AssetsTable({ assets }: { assets: SerializedPlanAsset[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanAsset();
    router.refresh();
  };
  return (
    <Panel>
      <Heading>Assets</Heading>
      <Table>
        {/* …existing thead (with the new trailing <th></th>) + tbody… */}
      </Table>
      <AddRowButton label="Add asset" onAdd={add} />
    </Panel>
  );
}
```

(`useRouter` must be imported at the top of the file; the `AssetsTable` function body calls it at the top level — it's a client component already via `"use client"`.)

- [ ] **Step 2: LiabilitiesTable — add Remove column + Add button, always render**

In `src/app/plan/LiabilitiesTable.tsx`:

1. `import { createPlanLiability, deletePlanLiability, updatePlanLiability } from "./actions";`
2. `import { AddRowButton, RemoveCell } from "./RowControls";`
3. In `LiabilityRow`, add the `remove` handler:

```tsx
  const remove = async () => {
    setError(null);
    try {
      await deletePlanLiability({ id: liability.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };
```

4. Add the trailing remove cell to the row and a trailing `<th></th>` to the header; bump the error-row `colSpan` from `5` to `6`.
5. **Remove the early return** `if (liabilities.length === 0) return null;` and instead always render the panel; show an empty hint when there are no rows and always render the Add button:

```tsx
export function LiabilitiesTable({
  liabilities,
}: { liabilities: SerializedPlanLiability[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanLiability();
    router.refresh();
  };
  return (
    <Panel>
      <Heading>Liabilities</Heading>
      <Table>
        <thead>{/* …existing headers + trailing <th></th>… */}</thead>
        <tbody>
          {liabilities.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <span style={{ color: "#999999", fontSize: 13 }}>No liabilities yet.</span>
              </td>
            </tr>
          ) : (
            liabilities.map((l) => <LiabilityRow key={l.id} liability={l} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add liability" onAdd={add} />
    </Panel>
  );
}
```

Add `import { useRouter } from "next/navigation";` at the top if not already imported (it is used by `LiabilityRow`; ensure the table function can call it too). For the empty hint, prefer a styled `Empty` span matching the other tables rather than an inline style if the file already defines styled helpers — match the file's existing style approach.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/AssetsTable.tsx src/app/plan/LiabilitiesTable.tsx
git commit -m "feat(plan): add/remove rows on assets & liabilities tables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: E2E — add / edit / remove a plan row

**Files:**
- Modify: `e2e/plan.spec.ts`

**Interfaces:**
- Consumes: the wired `/plan` page (Tasks 5–7).

- [ ] **Step 1: Add CRUD steps to the existing test**

In `e2e/plan.spec.ts`, insert before the final `await page.screenshot(...)` line. It uses the seeded plan already created earlier in the test:

```ts
  // CRUD: add an income, edit it, then confirm-remove it.
  const incomePanel = page.locator("section", { hasText: "Income" });
  await incomePanel.getByRole("button", { name: "+ Add income" }).click();
  const incomeRow = incomePanel.locator("table tbody tr").first();
  const incomeLabel = incomeRow.locator("input[type='text']").first();
  await expect(incomeLabel).toHaveValue("New income");
  await incomeLabel.fill("Freelance");
  await incomeLabel.blur();
  await expect(incomeLabel).toHaveValue("Freelance");

  await incomeRow.getByRole("button", { name: /^remove$/i }).click();
  await incomeRow.getByRole("button", { name: /yes/i }).click();
  await expect(incomePanel.getByText("No income yet.")).toBeVisible();

  // Add then remove an asset (Assets panel always present from the seeded SIPP).
  const assetPanel = page.locator("section", { hasText: "Assets" });
  await assetPanel.getByRole("button", { name: "+ Add asset" }).click();
  await expect(assetPanel.locator("table tbody tr")).toHaveCount(2);
```

- [ ] **Step 2: Run the e2e locally (system Chrome)**

First ensure the DB is up: `docker compose up -d db`
Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"`
Expected: PASS — the income row is added, edited, confirm-removed (empty hint shows), and a second asset row appears.

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): add/edit/remove plan rows through the browser

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `docker compose up -d db` then `pnpm verify` (typecheck + biome ci + unit) passes.
- [ ] `pnpm test:int` — all integration tests pass (existing + new `crudActions`).
- [ ] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"` passes.
- [ ] Live browser check (verify skill): on `/plan`, add an income/expense/event, edit fields (incl. switching growth to Fixed → the % cell appears), confirm-remove a row, and watch the chart/verdict update after each change.

## Notes

- The engine already handles empty collections (no-assets → synthetic CASH pot; no-income/expense → zero), so removing every row is safe.
- Per the spec, the five tables intentionally each live in their own file (matching the existing AssetsTable/LiabilitiesTable pattern) rather than a generic mega-table; the Add/Remove controls and `BoolCell` are the shared pieces.

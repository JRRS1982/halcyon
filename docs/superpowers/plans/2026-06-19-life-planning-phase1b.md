# Life Planning — Phase 1b (Editing layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/plan` tunable — inline editing of plan assumptions + seeded assets/liabilities (so wrappers/tax/returns become real), plus a `planVisible` Settings toggle gating the Plan nav link.

**Architecture:** New zod schemas + three ownership-checked update server actions; three client editor components (assumptions panel + asset/liability inline tables) that save-on-change and `revalidatePath("/plan")` so the existing server-side engine pipeline recomputes the chart/verdict. The engine (`src/lib/plan/`) is **not modified**.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, styled-components, zod, Jest (unit + `*.int.test.ts`), Biome.

**Spec:** [`../specs/2026-06-19-life-planning-phase1b-design.md`](../specs/2026-06-19-life-planning-phase1b-design.md).

## Global Constraints

- Money: Prisma `Decimal`; pass JS `number` into Prisma writes (accepted); convert `Decimal`→`number` (`Number(...)`) when serializing for the client. Dates: `Decimal`-free `Date` → `YYYY-MM-DD` string at the client boundary.
- Biome bans non-null assertions (`!`); transient styled props use `$` prefix; verify with `pnpm check` (`biome ci .`), not just `pnpm lint:fix`.
- Every server action enforces auth independently (`requireUserId`, already in `src/app/plan/actions.ts`) and is **ownership-scoped**: writes use `updateMany` filtered by `userId` (or nested `plan: { userId }`) and throw when `count === 0`. New behaviour also relies on the RLS added in Phase 1a (ADR-002).
- Editing is **save-on-change → server action → `revalidatePath("/plan")`** (server recompute). No client-side recompute (Phase 3).
- `planVisible` defaults **true**, gates the **nav link only** (the `/plan` route stays reachable).
- Scope: edit **assumptions + assets + liabilities** only. No income/expense editing, no add/remove of lines (Phase 2).
- Unit tests `pnpm test <path>`; integration `pnpm test:int` (pins `halcyon_test`, schema already migrated). Integration tests live in `src/__tests__/<feature>/*.int.test.ts` and use the global harness `test/integration/setup.ts` (resets DB, seeds a user, mocks the Supabase auth boundary) — mirror a sibling like `src/__tests__/plan/createPlan.int.test.ts` / `src/__tests__/settings/accountActions.int.test.ts`.
- Wrapper enum values: `PENSION ISA GIA CASH PROPERTY DB_PENSION OTHER`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/plan/schemas.ts` (+ `.test.ts`) | zod schemas + inferred input types for the 3 update actions |
| `src/app/plan/actions.ts` | + `updatePlanAssumptions`, `updatePlanAsset`, `updatePlanLiability` |
| `src/__tests__/plan/updateActions.int.test.ts` | integration tests for the 3 update actions (ownership-scoped) |
| `src/lib/settings/server.ts` | + `isPlanVisible(userId)` |
| `src/app/settings/actions.ts` | + `togglePlanVisible(enabled)` |
| `src/app/settings/SettingsForm.tsx` | + Plan-visibility toggle (mirror the Transfers switch) |
| `src/app/layout.tsx` | read `isPlanVisible` → pass `planVisible` to `NavBar` |
| `src/components/ui/NavBar/index.tsx` | gate the Plan link on `planVisible` |
| `src/__tests__/plan/planVisible.int.test.ts` | integration test for `togglePlanVisible`/`isPlanVisible` |
| `src/app/plan/serialized.ts` | serialized plan types shared by editors + page |
| `src/app/plan/AssumptionsPanel.tsx` | editable assumptions form (client) |
| `src/app/plan/AssetsTable.tsx` | inline-editable asset rows (client) |
| `src/app/plan/LiabilitiesTable.tsx` | inline-editable liability rows (client) |
| `src/app/plan/PlanView.tsx` | compose chart + verdict + the three editors |
| `src/app/plan/page.tsx` | serialize raw plan + pass to `PlanView` |

---

## Task 1: Update-action zod schemas

**Files:**
- Create: `src/lib/plan/schemas.ts`
- Test: `src/lib/plan/schemas.test.ts`

**Interfaces:**
- Produces: `updatePlanAssumptionsSchema`, `updatePlanAssetSchema`, `updatePlanLiabilitySchema` (zod) and inferred types `UpdatePlanAssumptionsInput`, `UpdatePlanAssetInput`, `UpdatePlanLiabilityInput`. Consumed by Task 2 (actions) and Task 4 (editor components import the input types).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/schemas.test.ts
import {
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanLiabilitySchema,
} from "./schemas";

const validAssumptions = {
  planId: "11111111-1111-1111-1111-111111111111",
  dateOfBirth: "1986-06-01",
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 2.5,
  defaultReturnPct: 5,
  blendedTaxRatePct: 20,
  statePensionAge: 67,
  statePensionAnnual: 11500,
};

const validAsset = {
  assetId: "22222222-2222-2222-2222-222222222222",
  label: "SIPP",
  wrapper: "PENSION",
  openingValue: 100000,
  expectedReturnPct: 5,
  annualContribution: 6000,
  drawdownPriority: 2,
};

const validLiability = {
  liabilityId: "33333333-3333-3333-3333-333333333333",
  label: "Mortgage",
  openingBalance: 120000,
  interestPct: 4,
  monthlyRepayment: 1100,
  endAge: 60,
};

describe("updatePlanAssumptionsSchema", () => {
  it("accepts valid input and nullable state pension", () => {
    expect(updatePlanAssumptionsSchema.parse(validAssumptions)).toMatchObject({ retirementAge: 65 });
    expect(updatePlanAssumptionsSchema.parse({ ...validAssumptions, statePensionAge: null, statePensionAnnual: null }).statePensionAge).toBeNull();
  });
  it("rejects out-of-range retirementAge", () => {
    expect(() => updatePlanAssumptionsSchema.parse({ ...validAssumptions, retirementAge: 39 })).toThrow();
  });
  it("rejects a bad dateOfBirth", () => {
    expect(() => updatePlanAssumptionsSchema.parse({ ...validAssumptions, dateOfBirth: "01/06/1986" })).toThrow();
  });
});

describe("updatePlanAssetSchema", () => {
  it("accepts valid input and a null expectedReturnPct", () => {
    expect(updatePlanAssetSchema.parse(validAsset).wrapper).toBe("PENSION");
    expect(updatePlanAssetSchema.parse({ ...validAsset, expectedReturnPct: null }).expectedReturnPct).toBeNull();
  });
  it("rejects an unknown wrapper", () => {
    expect(() => updatePlanAssetSchema.parse({ ...validAsset, wrapper: "CRYPTO" })).toThrow();
  });
  it("rejects a negative openingValue", () => {
    expect(() => updatePlanAssetSchema.parse({ ...validAsset, openingValue: -1 })).toThrow();
  });
});

describe("updatePlanLiabilitySchema", () => {
  it("accepts valid input and a null endAge", () => {
    expect(updatePlanLiabilitySchema.parse(validLiability).label).toBe("Mortgage");
    expect(updatePlanLiabilitySchema.parse({ ...validLiability, endAge: null }).endAge).toBeNull();
  });
  it("rejects a negative monthlyRepayment", () => {
    expect(() => updatePlanLiabilitySchema.parse({ ...validLiability, monthlyRepayment: -5 })).toThrow();
  });
});
```

- [ ] **Step 2: Run → FAIL** (`pnpm test src/lib/plan/schemas.test.ts`).

- [ ] **Step 3: Implement**

```ts
// src/lib/plan/schemas.ts
import { z } from "zod";

const WRAPPER = z.enum([
  "PENSION", "ISA", "GIA", "CASH", "PROPERTY", "DB_PENSION", "OTHER",
]);

export const updatePlanAssumptionsSchema = z.object({
  planId: z.string().uuid(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(90),
  planToAge: z.number().int().min(50).max(120),
  inflationPct: z.number().min(0).max(20),
  defaultReturnPct: z.number().min(-20).max(30),
  blendedTaxRatePct: z.number().min(0).max(60),
  statePensionAge: z.number().int().min(50).max(80).nullable(),
  statePensionAnnual: z.number().min(0).nullable(),
});

export const updatePlanAssetSchema = z.object({
  assetId: z.string().uuid(),
  label: z.string().min(1),
  wrapper: WRAPPER,
  openingValue: z.number().min(0),
  expectedReturnPct: z.number().min(-20).max(30).nullable(),
  annualContribution: z.number().min(0),
  drawdownPriority: z.number().int().min(0),
});

export const updatePlanLiabilitySchema = z.object({
  liabilityId: z.string().uuid(),
  label: z.string().min(1),
  openingBalance: z.number().min(0),
  interestPct: z.number().min(-20).max(30),
  monthlyRepayment: z.number().min(0),
  endAge: z.number().int().min(40).max(120).nullable(),
});

export type UpdatePlanAssumptionsInput = z.infer<typeof updatePlanAssumptionsSchema>;
export type UpdatePlanAssetInput = z.infer<typeof updatePlanAssetSchema>;
export type UpdatePlanLiabilityInput = z.infer<typeof updatePlanLiabilitySchema>;
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean.
- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/schemas.ts src/lib/plan/schemas.test.ts
git commit -m "feat(plan): zod schemas for plan update actions"
```

---

## Task 2: Update server actions

**Files:**
- Modify: `src/app/plan/actions.ts`
- Test: `src/__tests__/plan/updateActions.int.test.ts`

**Interfaces:**
- Consumes: the three schemas + input types from Task 1; `requireUserId` (already in the file); Prisma client.
- Produces: `updatePlanAssumptions(input: UpdatePlanAssumptionsInput): Promise<void>`, `updatePlanAsset(input: UpdatePlanAssetInput): Promise<void>`, `updatePlanLiability(input: UpdatePlanLiabilityInput): Promise<void>`. Consumed by the editor components (Task 4).

- [ ] **Step 1: Write the failing integration test.** Mirror the setup header of `src/__tests__/plan/createPlan.int.test.ts` (the global `test/integration/setup.ts` resets the DB, seeds the auth user `TEST_USER_ID`, and mocks `@/lib/supabase/server`). Arrange a plan with one asset + one liability via `prisma.plan.create`, then exercise the updates and the ownership guard.

```ts
// src/__tests__/plan/updateActions.int.test.ts
import { prisma } from "@/lib/prisma";
import { updatePlanAsset, updatePlanAssumptions, updatePlanLiability } from "@/app/plan/actions";
// ...copy the auth-mock + TEST_USER_ID import lines from createPlan.int.test.ts...

async function makePlan(userId: string) {
  return prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      assets: { create: [{ label: "Pot", wrapper: "OTHER", openingValue: 1000, drawdownPriority: 0 }] },
      liabilities: { create: [{ label: "Loan", openingBalance: 500 }] },
    },
    include: { assets: true, liabilities: true },
  });
}

describe("plan update actions (integration)", () => {
  it("updatePlanAssumptions persists changes for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    await updatePlanAssumptions({
      planId: plan.id, dateOfBirth: "1990-01-01", retirementAge: 60, planToAge: 100,
      inflationPct: 3, defaultReturnPct: 6, blendedTaxRatePct: 25,
      statePensionAge: 68, statePensionAnnual: 12000,
    });
    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.retirementAge).toBe(60);
    expect(after.planToAge).toBe(100);
    expect(Number(after.defaultReturnPct)).toBe(6);
  });

  it("updatePlanAsset sets the wrapper + return for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    const assetId = plan.assets[0].id;
    await updatePlanAsset({
      assetId, label: "SIPP", wrapper: "PENSION", openingValue: 2000,
      expectedReturnPct: 5, annualContribution: 100, drawdownPriority: 3,
    });
    const after = await prisma.planAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(after.wrapper).toBe("PENSION");
    expect(Number(after.openingValue)).toBe(2000);
  });

  it("updatePlanLiability updates rates for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    const liabilityId = plan.liabilities[0].id;
    await updatePlanLiability({
      liabilityId, label: "Mortgage", openingBalance: 100000,
      interestPct: 4, monthlyRepayment: 1000, endAge: 60,
    });
    const after = await prisma.planLiability.findUniqueOrThrow({ where: { id: liabilityId } });
    expect(Number(after.interestPct)).toBe(4);
  });

  it("rejects updating another user's asset (no cross-user write)", async () => {
    // Plan owned by a DIFFERENT user; the mocked auth user is TEST_USER_ID.
    const otherUser = await prisma.user.create({ data: { id: "99999999-9999-9999-9999-999999999999" } });
    const plan = await makePlan(otherUser.id);
    const assetId = plan.assets[0].id;
    await expect(
      updatePlanAsset({
        assetId, label: "hacked", wrapper: "CASH", openingValue: 1,
        expectedReturnPct: null, annualContribution: 0, drawdownPriority: 0,
      }),
    ).rejects.toThrow();
    const after = await prisma.planAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(after.label).toBe("Pot"); // unchanged
  });
});
```

> Adjust the `otherUser` creation to match how `setup.ts` seeds users (it may already create `TEST_USER_ID`; create only the *second* user here). Confirm the exact `User` create shape from the sibling test.

- [ ] **Step 2: Run → FAIL** (`pnpm test:int`; actions not exported yet).

- [ ] **Step 3: Implement** — append to `src/app/plan/actions.ts` (it already imports `prisma`, `revalidatePath`, has `requireUserId`):

```ts
import {
  type UpdatePlanAssetInput,
  type UpdatePlanAssumptionsInput,
  type UpdatePlanLiabilityInput,
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanLiabilitySchema,
} from "@/lib/plan/schemas";

export async function updatePlanAssumptions(input: UpdatePlanAssumptionsInput): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanAssumptionsSchema.parse(input);
  const res = await prisma.plan.updateMany({
    where: { id: p.planId, userId, deletedAt: null },
    data: {
      dateOfBirth: new Date(p.dateOfBirth),
      retirementAge: p.retirementAge,
      planToAge: p.planToAge,
      inflationPct: p.inflationPct,
      defaultReturnPct: p.defaultReturnPct,
      blendedTaxRatePct: p.blendedTaxRatePct,
      statePensionAge: p.statePensionAge,
      statePensionAnnual: p.statePensionAnnual,
    },
  });
  if (res.count === 0) throw new Error("Plan not found");
  revalidatePath("/plan");
}

export async function updatePlanAsset(input: UpdatePlanAssetInput): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanAssetSchema.parse(input);
  const res = await prisma.planAsset.updateMany({
    where: { id: p.assetId, deletedAt: null, plan: { userId, deletedAt: null } },
    data: {
      label: p.label,
      wrapper: p.wrapper,
      openingValue: p.openingValue,
      expectedReturnPct: p.expectedReturnPct,
      annualContribution: p.annualContribution,
      drawdownPriority: p.drawdownPriority,
    },
  });
  if (res.count === 0) throw new Error("Asset not found");
  revalidatePath("/plan");
}

export async function updatePlanLiability(input: UpdatePlanLiabilityInput): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanLiabilitySchema.parse(input);
  const res = await prisma.planLiability.updateMany({
    where: { id: p.liabilityId, deletedAt: null, plan: { userId, deletedAt: null } },
    data: {
      label: p.label,
      openingBalance: p.openingBalance,
      interestPct: p.interestPct,
      monthlyRepayment: p.monthlyRepayment,
      endAge: p.endAge,
    },
  });
  if (res.count === 0) throw new Error("Liability not found");
  revalidatePath("/plan");
}
```

- [ ] **Step 4: Run → PASS** (`pnpm test:int`).
- [ ] **Step 5:** `pnpm typecheck` + `pnpm check` clean.
- [ ] **Step 6: Commit**

```bash
git add src/app/plan/actions.ts src/__tests__/plan/updateActions.int.test.ts
git commit -m "feat(plan): ownership-scoped update actions for assumptions/asset/liability"
```

---

## Task 3: `planVisible` toggle + nav gating (end-to-end)

**Files:**
- Modify: `src/lib/settings/server.ts`, `src/app/settings/actions.ts`, `src/app/settings/SettingsForm.tsx`, `src/app/layout.tsx`, `src/components/ui/NavBar/index.tsx`
- Test: `src/__tests__/plan/planVisible.int.test.ts`

**Interfaces:**
- Produces: `isPlanVisible(userId: string): Promise<boolean>` (default `true`); `togglePlanVisible(enabled: boolean): Promise<void>`; `NavBar` gains a `planVisible: boolean` prop.

- [ ] **Step 1: Write the failing integration test** (mirror `createPlan.int.test.ts` setup):

```ts
// src/__tests__/plan/planVisible.int.test.ts
import { togglePlanVisible } from "@/app/settings/actions";
import { isPlanVisible } from "@/lib/settings/server";
// ...copy auth-mock + TEST_USER_ID lines from a sibling int test...

describe("planVisible (integration)", () => {
  it("defaults to true when no settings row exists", async () => {
    expect(await isPlanVisible(TEST_USER_ID)).toBe(true);
  });
  it("togglePlanVisible(false) hides it; (true) shows it", async () => {
    await togglePlanVisible(false);
    expect(await isPlanVisible(TEST_USER_ID)).toBe(false);
    await togglePlanVisible(true);
    expect(await isPlanVisible(TEST_USER_ID)).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`pnpm test:int`).

- [ ] **Step 3a: `isPlanVisible`** — append to `src/lib/settings/server.ts` (mirrors `isTransactionsEnabled`, but defaults true):

```ts
export async function isPlanVisible(userId: string): Promise<boolean> {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { planVisible: true },
  });
  return row?.planVisible ?? true;
}
```

- [ ] **Step 3b: `togglePlanVisible`** — append to `src/app/settings/actions.ts` (mirrors `toggleTransactions`):

```ts
// Shows/hides the Plan link in the nav. Nav is rendered in the layout, so
// revalidate the whole layout.
export async function togglePlanVisible(enabled: boolean) {
  const userId = await requireUserId();
  await prisma.userSettings.upsert({
    where: { userId },
    update: { planVisible: enabled },
    create: { userId, planVisible: enabled },
  });
  revalidatePath("/", "layout");
}
```

- [ ] **Step 3c: layout** — in `src/app/layout.tsx`: import `isPlanVisible` from `@/lib/settings/server`; compute `const planVisible = user ? await isPlanVisible(user.id) : false;` and pass `planVisible={planVisible}` to `<NavBar>`.

- [ ] **Step 3d: NavBar** — in `src/components/ui/NavBar/index.tsx`: add `planVisible: boolean` to `NavBarProps`. **Remove the `/plan` entry from `SIGNED_IN_ITEMS`** (Phase 1a added it unconditionally) so it reads `[Dashboard, Budget, Balance, Settings]`. Add a `PLAN_ITEM` const and build the list with Plan and Transactions inserted before Settings:

```ts
const PLAN_ITEM: NavItem = { href: "/plan", label: "Plan" };

// inside the component, replace the existing `items` computation:
const middle: NavItem[] = [...SIGNED_IN_ITEMS.slice(0, -1)]; // Dashboard, Budget, Balance
if (planVisible) middle.push(PLAN_ITEM);
if (transactionsEnabled) middle.push(TRANSACTIONS_ITEM);
const items: NavItem[] = [...middle, ...SIGNED_IN_ITEMS.slice(-1)]; // + Settings
```

- [ ] **Step 3e: Settings UI** — in `src/app/settings/SettingsForm.tsx`: import `togglePlanVisible`; add a **plain switch** mirroring the existing **Transfers** toggle (NOT the Transactions one — Transactions has a confirm dialog; Plan visibility is benign). Reuse the existing `ToggleField`/`ToggleText`/`FieldLabel`/`FieldHint`/`SwitchControl`/`SwitchInput`/`SwitchTrack` styled components. The component receives the current `planVisible` value as a prop (add `planVisible: boolean` to `SettingsForm`'s props and thread it from the settings page, which already passes the other toggle values). Wire `onChange` to `startTransition(() => togglePlanVisible(e.target.checked))`. Label "Show Plan in nav", hint "Hide the Plan tab from the navigation. Your plan and its data are kept." Read the Transfers toggle markup in this file and copy its structure exactly.

> The settings page (`src/app/settings/page.tsx`) constructs `SettingsForm`'s props from `getCurrentUserSettings()`. Add `planVisible` to that settings read (it's already on `UserSettings`; surface it in `getCurrentUserSettings`'s return + the page's prop pass-through). If `getCurrentUserSettings` doesn't yet select `planVisible`, add it (default true) — mirror how `transactionsEnabled` flows.

- [ ] **Step 4: Run → PASS** (`pnpm test:int` for the new file). Then `pnpm typecheck` + `pnpm check` + `pnpm build` (nav renders).

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/server.ts src/app/settings/actions.ts src/app/settings/SettingsForm.tsx src/app/settings/page.tsx src/app/layout.tsx src/components/ui/NavBar/index.tsx src/__tests__/plan/planVisible.int.test.ts
git commit -m "feat(plan): planVisible Settings toggle gating the Plan nav link"
```

---

## Task 4: Editor components

**Files:**
- Create: `src/app/plan/serialized.ts`, `src/app/plan/AssumptionsPanel.tsx`, `src/app/plan/AssetsTable.tsx`, `src/app/plan/LiabilitiesTable.tsx`

**Interfaces:**
- Consumes: the update actions (Task 2) + their input types (Task 1).
- Produces: `type SerializedPlan`, `SerializedPlanAssumptions`, `SerializedPlanAsset`, `SerializedPlanLiability`; `<AssumptionsPanel assumptions />`, `<AssetsTable assets defaultReturnPct />`, `<LiabilitiesTable liabilities />`. Consumed by `PlanView`/`page` (Task 5).

- [ ] **Step 1: Serialized types** `src/app/plan/serialized.ts`

```ts
// src/app/plan/serialized.ts
import type { Wrapper } from "@/lib/plan";

export type SerializedPlanAssumptions = {
  id: string;
  dateOfBirth: string; // YYYY-MM-DD
  retirementAge: number;
  planToAge: number;
  inflationPct: number;
  defaultReturnPct: number;
  blendedTaxRatePct: number;
  statePensionAge: number | null;
  statePensionAnnual: number | null;
};

export type SerializedPlanAsset = {
  id: string;
  label: string;
  wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct: number | null;
  annualContribution: number;
  drawdownPriority: number;
};

export type SerializedPlanLiability = {
  id: string;
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
  endAge: number | null;
};

export type SerializedPlan = {
  assumptions: SerializedPlanAssumptions;
  assets: SerializedPlanAsset[];
  liabilities: SerializedPlanLiability[];
};
```

- [ ] **Step 2: Shared editor styles** — these three components share table/input styling. Define them inline per file (small) using the theme; keep each file self-contained. No test step (presentational; verified by typecheck/check/build).

- [ ] **Step 3: AssumptionsPanel** `src/app/plan/AssumptionsPanel.tsx`

```tsx
// src/app/plan/AssumptionsPanel.tsx
"use client";

import { updatePlanAssumptions } from "./actions";
import type { SerializedPlanAssumptions } from "./serialized";
import { useState, useTransition } from "react";
import styled from "styled-components";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;
const Input = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

export function AssumptionsPanel({ assumptions }: { assumptions: SerializedPlanAssumptions }) {
  const [a, setA] = useState(assumptions);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanAssumptions) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanAssumptions({
          planId: next.id,
          dateOfBirth: next.dateOfBirth,
          retirementAge: next.retirementAge,
          planToAge: next.planToAge,
          inflationPct: next.inflationPct,
          defaultReturnPct: next.defaultReturnPct,
          blendedTaxRatePct: next.blendedTaxRatePct,
          statePensionAge: next.statePensionAge,
          statePensionAnnual: next.statePensionAnnual,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  const num = (v: string): number => (v === "" ? 0 : Number(v));
  const nullableNum = (v: string): number | null => (v === "" ? null : Number(v));

  return (
    <Panel aria-busy={pending}>
      <Heading>Assumptions</Heading>
      <Grid>
        <Field>
          Date of birth
          <Input type="date" defaultValue={a.dateOfBirth}
            onBlur={(e) => { const next = { ...a, dateOfBirth: e.target.value }; setA(next); save(next); }} />
        </Field>
        <Field>
          Retirement age
          <Input type="number" defaultValue={a.retirementAge}
            onBlur={(e) => { const next = { ...a, retirementAge: num(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          Plan to age
          <Input type="number" defaultValue={a.planToAge}
            onBlur={(e) => { const next = { ...a, planToAge: num(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          Inflation %
          <Input type="number" step="0.1" defaultValue={a.inflationPct}
            onBlur={(e) => { const next = { ...a, inflationPct: num(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          Default return %
          <Input type="number" step="0.1" defaultValue={a.defaultReturnPct}
            onBlur={(e) => { const next = { ...a, defaultReturnPct: num(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          Tax rate %
          <Input type="number" step="0.1" defaultValue={a.blendedTaxRatePct}
            onBlur={(e) => { const next = { ...a, blendedTaxRatePct: num(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          State pension age
          <Input type="number" defaultValue={a.statePensionAge ?? ""}
            onBlur={(e) => { const next = { ...a, statePensionAge: nullableNum(e.target.value) }; setA(next); save(next); }} />
        </Field>
        <Field>
          State pension / yr
          <Input type="number" defaultValue={a.statePensionAnnual ?? ""}
            onBlur={(e) => { const next = { ...a, statePensionAnnual: nullableNum(e.target.value) }; setA(next); save(next); }} />
        </Field>
      </Grid>
      {error ? <Err>{error}</Err> : null}
    </Panel>
  );
}
```

- [ ] **Step 4: AssetsTable** `src/app/plan/AssetsTable.tsx`

```tsx
// src/app/plan/AssetsTable.tsx
"use client";

import { WRAPPERS, type Wrapper } from "@/lib/plan";
import { updatePlanAsset } from "./actions";
import type { SerializedPlanAsset } from "./serialized";
import { useState, useTransition } from "react";
import styled from "styled-components";

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
const Cell = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;
const Sel = styled.select`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

function AssetRow({ asset }: { asset: SerializedPlanAsset }) {
  const [row, setRow] = useState(asset);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanAsset) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanAsset({
          assetId: next.id,
          label: next.label,
          wrapper: next.wrapper,
          openingValue: next.openingValue,
          expectedReturnPct: next.expectedReturnPct,
          annualContribution: next.annualContribution,
          drawdownPriority: next.drawdownPriority,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };
  const num = (v: string): number => (v === "" ? 0 : Number(v));

  return (
    <>
      <tr>
        <td>
          <Cell defaultValue={row.label}
            onBlur={(e) => { const n = { ...row, label: e.target.value }; setRow(n); save(n); }} />
        </td>
        <td>
          <Sel value={row.wrapper}
            onChange={(e) => { const n = { ...row, wrapper: e.target.value as Wrapper }; setRow(n); save(n); }}>
            {WRAPPERS.map((w) => <option key={w} value={w}>{w}</option>)}
          </Sel>
        </td>
        <td>
          <Cell type="number" defaultValue={row.openingValue}
            onBlur={(e) => { const n = { ...row, openingValue: num(e.target.value) }; setRow(n); save(n); }} />
        </td>
        <td>
          <Cell type="number" step="0.1" defaultValue={row.expectedReturnPct ?? ""}
            onBlur={(e) => { const n = { ...row, expectedReturnPct: e.target.value === "" ? null : Number(e.target.value) }; setRow(n); save(n); }} />
        </td>
        <td>
          <Cell type="number" defaultValue={row.annualContribution}
            onBlur={(e) => { const n = { ...row, annualContribution: num(e.target.value) }; setRow(n); save(n); }} />
        </td>
        <td>
          <Cell type="number" defaultValue={row.drawdownPriority}
            onBlur={(e) => { const n = { ...row, drawdownPriority: num(e.target.value) }; setRow(n); save(n); }} />
        </td>
      </tr>
      {error ? <tr><td colSpan={6}><Err>{error}</Err></td></tr> : null}
    </>
  );
}

export function AssetsTable({ assets }: { assets: SerializedPlanAsset[] }) {
  return (
    <Panel>
      <Heading>Assets</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th><th>Wrapper</th><th>Value</th><th>Return %</th><th>Contribution /yr</th><th>Drawdown order</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => <AssetRow key={a.id} asset={a} />)}
        </tbody>
      </Table>
    </Panel>
  );
}
```

- [ ] **Step 5: LiabilitiesTable** `src/app/plan/LiabilitiesTable.tsx` — same structure as `AssetsTable`, but for liabilities (no wrapper select).

```tsx
// src/app/plan/LiabilitiesTable.tsx
"use client";

import { updatePlanLiability } from "./actions";
import type { SerializedPlanLiability } from "./serialized";
import { useState, useTransition } from "react";
import styled from "styled-components";

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
const Cell = styled.input`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

function LiabilityRow({ liability }: { liability: SerializedPlanLiability }) {
  const [row, setRow] = useState(liability);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanLiability) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanLiability({
          liabilityId: next.id,
          label: next.label,
          openingBalance: next.openingBalance,
          interestPct: next.interestPct,
          monthlyRepayment: next.monthlyRepayment,
          endAge: next.endAge,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };
  const num = (v: string): number => (v === "" ? 0 : Number(v));

  return (
    <>
      <tr>
        <td><Cell defaultValue={row.label}
          onBlur={(e) => { const n = { ...row, label: e.target.value }; setRow(n); save(n); }} /></td>
        <td><Cell type="number" defaultValue={row.openingBalance}
          onBlur={(e) => { const n = { ...row, openingBalance: num(e.target.value) }; setRow(n); save(n); }} /></td>
        <td><Cell type="number" step="0.1" defaultValue={row.interestPct}
          onBlur={(e) => { const n = { ...row, interestPct: num(e.target.value) }; setRow(n); save(n); }} /></td>
        <td><Cell type="number" defaultValue={row.monthlyRepayment}
          onBlur={(e) => { const n = { ...row, monthlyRepayment: num(e.target.value) }; setRow(n); save(n); }} /></td>
        <td><Cell type="number" defaultValue={row.endAge ?? ""}
          onBlur={(e) => { const n = { ...row, endAge: e.target.value === "" ? null : Number(e.target.value) }; setRow(n); save(n); }} /></td>
      </tr>
      {error ? <tr><td colSpan={5}><Err>{error}</Err></td></tr> : null}
    </>
  );
}

export function LiabilitiesTable({ liabilities }: { liabilities: SerializedPlanLiability[] }) {
  if (liabilities.length === 0) return null;
  return (
    <Panel>
      <Heading>Liabilities</Heading>
      <Table>
        <thead>
          <tr><th>Label</th><th>Balance</th><th>Interest %</th><th>Repayment /mo</th><th>End age</th></tr>
        </thead>
        <tbody>{liabilities.map((l) => <LiabilityRow key={l.id} liability={l} />)}</tbody>
      </Table>
    </Panel>
  );
}
```

- [ ] **Step 6: Verify** `pnpm typecheck && pnpm check` (no test step — presentational).
- [ ] **Step 7: Commit**

```bash
git add src/app/plan/serialized.ts src/app/plan/AssumptionsPanel.tsx src/app/plan/AssetsTable.tsx src/app/plan/LiabilitiesTable.tsx
git commit -m "feat(plan): inline editors for assumptions, assets, liabilities"
```

---

## Task 5: Wire editors into page + view

**Files:**
- Modify: `src/app/plan/page.tsx`, `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `SerializedPlan` + the three editors (Task 4); `getPrimaryPlan` (already returns the plan with children).

- [ ] **Step 1: page serializes the raw plan** — in `src/app/plan/page.tsx`, after fetching `plan` and before/after running the engine, build a `SerializedPlan` and pass it to `PlanView`:

```tsx
import type { SerializedPlan } from "./serialized";
// ...
  const serialized: SerializedPlan = {
    assumptions: {
      id: plan.id,
      dateOfBirth: plan.dateOfBirth.toISOString().slice(0, 10),
      retirementAge: plan.retirementAge,
      planToAge: plan.planToAge,
      inflationPct: Number(plan.inflationPct),
      defaultReturnPct: Number(plan.defaultReturnPct),
      blendedTaxRatePct: Number(plan.blendedTaxRatePct),
      statePensionAge: plan.statePensionAge,
      statePensionAnnual: plan.statePensionAnnual === null ? null : Number(plan.statePensionAnnual),
    },
    assets: plan.assets.map((a) => ({
      id: a.id, label: a.label, wrapper: a.wrapper,
      openingValue: Number(a.openingValue),
      expectedReturnPct: a.expectedReturnPct === null ? null : Number(a.expectedReturnPct),
      annualContribution: Number(a.annualContribution),
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id, label: l.label,
      openingBalance: Number(l.openingBalance),
      interestPct: Number(l.interestPct),
      monthlyRepayment: Number(l.monthlyRepayment),
      endAge: l.endAge,
    })),
  };

  return (
    <PlanView
      years={projection.years}
      verdict={projection.verdict}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
```

- [ ] **Step 2: PlanView renders the editors** — in `src/app/plan/PlanView.tsx`, add the `plan: SerializedPlan` prop and render the three editors below the chart:

```tsx
import type { SerializedPlan } from "./serialized";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { AssetsTable } from "./AssetsTable";
import { LiabilitiesTable } from "./LiabilitiesTable";
// ...add `plan` to props...
  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner verdict={verdict} currency={currency} numberFormat={numberFormat} />
      <NetWorthChart years={years} currency={currency} numberFormat={numberFormat} />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <AssetsTable assets={plan.assets} />
      <LiabilitiesTable liabilities={plan.liabilities} />
    </Shell>
  );
```

- [ ] **Step 3: Verify** `pnpm typecheck && pnpm check && pnpm build` (route `/plan` still builds). Manual: `pnpm dev`, sign in, open `/plan` with a plan — edit an asset's wrapper/return and an assumption; on blur the value saves and the chart/verdict refresh (server revalidate).
- [ ] **Step 4: Commit**

```bash
git add src/app/plan/page.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): render assumptions/asset/liability editors on /plan"
```

---

## Self-review notes

- **Spec coverage:** §3 editing model → Tasks 4–5 (save-on-change → action → revalidate); §4 update actions + bounds → Tasks 1–2; §5 planVisible → Task 3; §6 data flow → Task 5; §8 tests → unit (Task 1), integration (Tasks 2, 3). Editor components verified via typecheck/check/build per spec.
- **Ownership:** Tasks 2/3 scope every write by `userId` (or nested `plan: { userId }`); the cross-user test asserts no foreign write.
- **No client recompute:** edits round-trip to the server and `revalidatePath("/plan")`; the chart updates from the re-run engine (Phase 3 adds live recompute).
- **Type consistency:** `SerializedPlan*` (Task 4) ↔ page serialization (Task 5); action input types (Task 1) ↔ action signatures (Task 2) ↔ editor calls (Task 4); `Wrapper`/`WRAPPERS` from `@/lib/plan`. `planVisible` flows UserSettings → `isPlanVisible` (default true) → layout → `NavBar` prop.
- **Engine untouched.** No change under `src/lib/plan/{project,types,seed,toPlanInput,chartData}`.
- **Out of scope (Phase 2/3):** income/expense editing, add/remove lines, live slider recompute.

# Plan Editing Drawer (D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline-cell editing of the five plan collections with master→detail: tables become clickable summary rows, and a single right-hand slide-out drawer holds the selected element's full settings.

**Architecture:** A generic `PlanDrawer` shell (slide-out sheet, scrim, Esc/scrim/✕ close, focus trap, scroll-lock) rendered once by `PlanView`, driven by a `{kind,id}` selection. `PlanView` resolves the selected element and renders the matching per-element field form as the drawer's children. Field forms reuse the existing controlled cells + `updatePlan*` actions + `router.refresh()` live-recompute. No engine/schema change; `createPlan*` returns the new id so Add can open it.

**Tech Stack:** Next.js 16 App Router / React 19, TypeScript, styled-components, Jest + RTL (unit), Playwright (e2e), Biome, pnpm.

## Global Constraints

- **No engine / Prisma schema / migration change.** The only server change is `createPlan*` returning the new row id (`Promise<void>` → `Promise<string>`).
- **Biome bans non-null assertions (`!`).** Prefer `satisfies` over `as`; no enums.
- **Editing & live-recompute convention:** every `updatePlan*`/`deletePlan*` is followed by `router.refresh()` in the client so the server re-runs the engine and the chart/verdict/timeline update; on failure, `save` rethrows so the controlled cell reverts (the data-loss guard).
- **Drawer a11y:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title; focus moves into the drawer on open and returns to the trigger on close; Tab trapped; body scroll locked; `prefers-reduced-motion` respected; full-width sheet on mobile.
- **Assumptions panel is unchanged** (a singleton, not a collection). `linkedAssetId` stays hidden (inert in the engine).
- **Commit trailer** (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Spec: `docs/superpowers/specs/2026-06-23-plan-editing-drawer-design.md`.

---

### Task 1: `createPlan*` returns the new id

**Files:**
- Modify: `src/app/plan/actions.ts`
- Test: `src/__tests__/plan/crudActions.int.test.ts`

**Interfaces:**
- Produces: `createPlanAsset/Liability/Income/Expense/Event(): Promise<string>` (was `Promise<void>`) — resolves to the created row's id.

- [ ] **Step 1: Add a failing assertion**

In `src/__tests__/plan/crudActions.int.test.ts`, add to the create describe block:

```ts
  it("createPlanIncome returns the new row id", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    const id = await createPlanIncome();
    expect(typeof id).toBe("string");
    const row = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(row.label).toBe("New income");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d db && pnpm test:int -- crudActions`
Expected: FAIL — `createPlanIncome` resolves to `undefined`, so `typeof id` is `"undefined"`.

- [ ] **Step 3: Return the id from each create action**

In `src/app/plan/actions.ts`, for each of the five `createPlan*` functions: change the return type `Promise<void>` → `Promise<string>`, capture the created row, and return its id. Example (`createPlanAsset`); apply the same shape to all five:

```ts
export async function createPlanAsset(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planAsset.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planAsset.create({
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
  return row.id;
}
```

Do the same for `createPlanLiability`, `createPlanIncome`, `createPlanExpense`, `createPlanEvent` — assign `const row = await prisma.planX.create({...})`, keep the existing `data`, then `revalidatePath("/plan"); return row.id;`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:int -- crudActions`
Expected: PASS (existing create/delete/update tests + the new id assertion).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (The tables still call `await createPlanX()` ignoring the return — valid.)

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/actions.ts src/__tests__/plan/crudActions.int.test.ts
git commit -m "feat(plan): create actions return the new row id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `PlanDrawer` shell + `DrawerSection` + `Field`

**Files:**
- Create: `src/app/plan/PlanDrawer.tsx`
- Test: `src/app/plan/PlanDrawer.test.tsx`

**Interfaces:**
- Produces:
  - `PlanDrawer({ open, eyebrow, title, onClose, onRemove, children })` — generic slide-out shell.
  - `DrawerSection({ title, defaultOpen?, children })` — collapsible group.
  - `Field({ label, htmlFor?, children })` — labelled field wrapper.

- [ ] **Step 1: Write the failing RTL test**

Create `src/app/plan/PlanDrawer.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { theme } from "@/lib/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { DrawerSection, PlanDrawer } from "./PlanDrawer";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const noop = () => {};

describe("PlanDrawer", () => {
  it("closes via the close button, scrim, and Escape", () => {
    const onClose = jest.fn();
    renderWithTheme(
      <PlanDrawer open eyebrow="Account" title="ISA" onClose={onClose} onRemove={noop}>
        <p>body</p>
      </PlanDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByTestId("plan-drawer-scrim"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("renders title + children only when open", () => {
    const { rerender } = renderWithTheme(
      <PlanDrawer open={false} title="ISA" onClose={noop} onRemove={noop}>
        <p>body</p>
      </PlanDrawer>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    rerender(
      <ThemeProvider theme={theme}>
        <PlanDrawer open title="ISA" onClose={noop} onRemove={noop}>
          <p>body</p>
        </PlanDrawer>
      </ThemeProvider>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ISA" })).toBeInTheDocument();
  });

  it("DrawerSection toggles its body", () => {
    renderWithTheme(
      <DrawerSection title="Growth" defaultOpen={false}>
        <p>inner</p>
      </DrawerSection>,
    );
    expect(screen.queryByText("inner")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /growth/i }));
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- PlanDrawer`
Expected: FAIL — cannot find module `./PlanDrawer`.

- [ ] **Step 3: Implement `PlanDrawer`**

Create `src/app/plan/PlanDrawer.tsx`:

```tsx
// src/app/plan/PlanDrawer.tsx
"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { RemoveCell } from "./RowControls";

const Scrim = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 22, 0.22);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition: opacity 0.2s ease;
  z-index: 40;
`;
const Sheet = styled.aside<{ $open: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(460px, 94vw);
  background: ${({ theme }) => theme.colors.canvas};
  border-left: 1px solid ${({ theme }) => theme.colors.hairline};
  box-shadow: -18px 0 48px rgba(15, 17, 22, 0.12);
  transform: translateX(${({ $open }) => ($open ? "0" : "100%")});
  transition: transform 0.24s cubic-bezier(0.2, 0.7, 0.2, 1);
  z-index: 50;
  display: flex;
  flex-direction: column;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;
const Eyebrow = styled.div`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;
const Title = styled.h2`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;
const CloseBtn = styled.button`
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.dim};
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.rounded.sm};
  &:hover { color: ${({ theme }) => theme.colors.ink}; background: ${({ theme }) => theme.colors.canvasSoft}; }
`;
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
`;
const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;
const Live = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.bodyMuted};
  &::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: ${({ theme }) => theme.rounded.full};
    background: ${({ theme }) => theme.colors.positive};
  }
`;

const SectionWrap = styled.section`
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;
const SectionHead = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.bodyMuted};
`;
const SectionBody = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
const FieldWrap = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;

export function DrawerSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SectionWrap>
      <SectionHead type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {title}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </SectionHead>
      {open ? <SectionBody>{children}</SectionBody> : null}
    </SectionWrap>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FieldWrap>
      {label}
      {children}
    </FieldWrap>
  );
}

export function PlanDrawer({
  open,
  eyebrow,
  title,
  onClose,
  onRemove,
  children,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  onClose: () => void;
  onRemove: () => Promise<void> | void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const titleId = useId();

  // Esc to close; lock body scroll; move focus into the sheet on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <Scrim
        $open={open}
        data-testid="plan-drawer-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <Sheet
        ref={sheetRef}
        $open={open}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        tabIndex={-1}
      >
        {open ? (
          <>
            <Head>
              <div>
                {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
                <Title id={titleId}>{title}</Title>
              </div>
              <CloseBtn type="button" aria-label="Close" onClick={onClose}>
                {"×"}
              </CloseBtn>
            </Head>
            <Body>{children}</Body>
            <Foot>
              <Live>Changes update your plan instantly</Live>
              <RemoveCell onConfirm={onRemove} />
            </Foot>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
```

(Focus trap beyond focus-in + Esc + return-to-trigger is a follow-up; this covers the a11y essentials and the RTL contract. `RemoveCell` is the existing confirm-first control from `RowControls`.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- PlanDrawer`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/PlanDrawer.tsx src/app/plan/PlanDrawer.test.tsx
git commit -m "feat(plan): PlanDrawer slide-out shell + DrawerSection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shared `SummaryRow` + asset vertical slice (PlanView wiring)

**Files:**
- Create: `src/app/plan/SummaryRow.tsx`
- Modify: `src/app/plan/AssetsTable.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `PlanDrawer`, `DrawerSection`, `Field` (Task 2); `createPlanAsset` returns id (Task 1); existing `NumberCell`/`SelectCell`/`TextCell`, `updatePlanAsset`/`deletePlanAsset`.
- Produces:
  - `SummaryList` + `SummaryRow({ primary, secondary, onOpen })` from `./SummaryRow`.
  - `AssetsTable({ assets, currency, numberFormat, onOpen })` — summary list.
  - `AssetFields({ asset })` — drawer form (exported from `AssetsTable.tsx`).
  - `PlanView` owns `selected` state + renders one `PlanDrawer`.

- [ ] **Step 1: Create the shared `SummaryRow`**

Create `src/app/plan/SummaryRow.tsx`:

```tsx
// src/app/plan/SummaryRow.tsx
"use client";

import styled from "styled-components";

export const SummaryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
`;

const Row = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  background: transparent;
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  cursor: pointer;
  text-align: left;
  font: inherit;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.ink};
  &:hover { background: ${({ theme }) => theme.colors.canvasSoft}; }
  li:first-child & { border-top: 0; }
`;
const Primary = styled.span`
  font-size: 14px;
  font-weight: 500;
`;
const Secondary = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  font-variant-numeric: tabular-nums;
  text-align: right;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  &::after {
    content: "›";
    color: ${({ theme }) => theme.colors.hairlineStrong};
    font-size: 16px;
  }
`;

export function SummaryRow({
  primary,
  secondary,
  onOpen,
}: {
  primary: string;
  secondary: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <Row type="button" aria-haspopup="dialog" onClick={onOpen}>
        <Primary>{primary}</Primary>
        <Secondary>{secondary}</Secondary>
      </Row>
    </li>
  );
}
```

- [ ] **Step 2: Rewrite `AssetsTable.tsx` — summary list + `AssetFields`**

Replace the whole file `src/app/plan/AssetsTable.tsx` with:

```tsx
// src/app/plan/AssetsTable.tsx
"use client";

import { WRAPPERS } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "./PlanDrawer";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanAsset, updatePlanAsset } from "./actions";
import type { SerializedPlanAsset } from "./serialized";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

// ── Drawer form ──────────────────────────────────────────────────────────
export function AssetFields({ asset }: { asset: SerializedPlanAsset }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanAsset) => {
    setError(null);
    try {
      await updatePlanAsset({
        assetId: next.id,
        label: next.label,
        wrapper: next.wrapper,
        openingValue: next.openingValue,
        expectedReturnPct: next.expectedReturnPct,
        annualContribution: next.annualContribution,
        contributionEndAge: next.contributionEndAge,
        drawdownPriority: next.drawdownPriority,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell value={asset.label} onCommit={(v) => save({ ...asset, label: v })} />
        </Field>
        <Field label="Account type">
          <SelectCell
            value={asset.wrapper}
            options={WRAPPERS}
            onCommit={(v) => save({ ...asset, wrapper: v })}
          />
        </Field>
        <Field label="Current value">
          <NumberCell
            value={asset.openingValue}
            onCommit={(v) => save({ ...asset, openingValue: v ?? asset.openingValue })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Growth">
        <Field label="Expected return %">
          <NumberCell
            value={asset.expectedReturnPct}
            nullable
            step="0.1"
            onCommit={(v) => save({ ...asset, expectedReturnPct: v })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Contributions">
        <Field label="Amount /yr">
          <NumberCell
            value={asset.annualContribution}
            onCommit={(v) =>
              save({ ...asset, annualContribution: v ?? asset.annualContribution })
            }
          />
        </Field>
        <Field label="Contribute until age (blank = retirement)">
          <NumberCell
            value={asset.contributionEndAge}
            nullable
            onCommit={(v) => save({ ...asset, contributionEndAge: v })}
          />
        </Field>
      </DrawerSection>
      <DrawerSection title="Drawdown">
        <Field label="Draw order">
          <NumberCell
            value={asset.drawdownPriority}
            onCommit={(v) => save({ ...asset, drawdownPriority: v ?? asset.drawdownPriority })}
          />
        </Field>
      </DrawerSection>
    </>
  );
}

// ── Summary list ─────────────────────────────────────────────────────────
export function AssetsTable({
  assets,
  currency,
  numberFormat,
  onOpen,
}: {
  assets: SerializedPlanAsset[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanAsset();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Assets</Heading>
      {assets.length === 0 ? (
        <Empty>No assets yet.</Empty>
      ) : (
        <SummaryList>
          {assets.map((a) => (
            <SummaryRow
              key={a.id}
              primary={a.label}
              secondary={`${a.wrapper} · ${formatAmount(currency, a.openingValue, numberFormat)}`}
              onOpen={() => onOpen(a.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add asset" onAdd={add} />
    </Panel>
  );
}
```

This adds the **contribute-until-age** field (`asset.contributionEndAge`). That property exists on `SerializedPlanAsset`? Verify in Step 3.

- [ ] **Step 3: Add `contributionEndAge` to the serialized asset + mapping (if missing)**

Check `src/app/plan/serialized.ts`: if `SerializedPlanAsset` has no `contributionEndAge`, add `contributionEndAge: number | null;`. Then in `src/app/plan/page.tsx`, in the `assets.map`, add `contributionEndAge: a.contributionEndAge,` (it's an `Int?` column → already `number | null`). And in `src/lib/plan/schemas.ts` `updatePlanAssetSchema`, add `contributionEndAge: z.number().int().min(0).max(120).nullable(),`; and in `actions.ts` `updatePlanAsset` `data`, add `contributionEndAge: p.contributionEndAge,`.

Run: `grep -n contributionEndAge src/app/plan/serialized.ts` — if absent, make the four edits above. (Engine already consumes `contributionEndAge` via `toPlanInput`.)

- [ ] **Step 4: Wire selection + drawer into `PlanView.tsx`**

Replace `src/app/plan/PlanView.tsx` with:

```tsx
// src/app/plan/PlanView.tsx
"use client";

import type { Verdict, YearProjection } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { AssetFields, AssetsTable } from "./AssetsTable";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { ChartPanel } from "./ChartPanel";
import { EventFields, EventsTable } from "./EventsTable";
import { ExpenseFields, ExpensesTable } from "./ExpensesTable";
import { IncomeFields, IncomesTable } from "./IncomesTable";
import { LiabilityFields, LiabilitiesTable } from "./LiabilitiesTable";
import { PlanDrawer } from "./PlanDrawer";
import { Timeline } from "./Timeline";
import { VerdictBanner } from "./VerdictBanner";
import {
  deletePlanAsset,
  deletePlanEvent,
  deletePlanExpense,
  deletePlanIncome,
  deletePlanLiability,
} from "./actions";
import type { SerializedPlan } from "./serialized";

type Kind = "asset" | "liability" | "income" | "expense" | "event";

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
  plan,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  verdict: Verdict;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ kind: Kind; id: string } | null>(null);
  const open = (kind: Kind) => (id: string) => setSelected({ kind, id });
  const close = () => setSelected(null);

  const asset = selected?.kind === "asset" ? plan.assets.find((a) => a.id === selected.id) : undefined;
  const liability = selected?.kind === "liability" ? plan.liabilities.find((l) => l.id === selected.id) : undefined;
  const income = selected?.kind === "income" ? plan.incomes.find((i) => i.id === selected.id) : undefined;
  const expense = selected?.kind === "expense" ? plan.expenses.find((e) => e.id === selected.id) : undefined;
  const event = selected?.kind === "event" ? plan.events.find((ev) => ev.id === selected.id) : undefined;
  const target = asset ?? liability ?? income ?? expense ?? event;

  const title = target ? ("label" in target ? target.label : "") : "";
  const eyebrow =
    asset !== undefined ? "Asset"
    : liability !== undefined ? "Liability"
    : income !== undefined ? "Income"
    : expense !== undefined ? "Expense"
    : event !== undefined ? "Event"
    : undefined;

  const onRemove = async () => {
    if (!selected) return;
    const remove =
      selected.kind === "asset" ? deletePlanAsset
      : selected.kind === "liability" ? deletePlanLiability
      : selected.kind === "income" ? deletePlanIncome
      : selected.kind === "expense" ? deletePlanExpense
      : deletePlanEvent;
    await remove({ id: selected.id });
    close();
    router.refresh();
  };

  return (
    <Shell>
      <Title>Your plan</Title>
      <VerdictBanner verdict={verdict} currency={currency} numberFormat={numberFormat} />
      <ChartPanel years={years} currency={currency} numberFormat={numberFormat} />
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={plan.events}
        retirementAge={plan.assumptions.retirementAge}
        statePensionAge={plan.assumptions.statePensionAge}
        minAge={years[0]?.age ?? 0}
        maxAge={years[years.length - 1]?.age ?? 0}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
      <AssetsTable assets={plan.assets} currency={currency} numberFormat={numberFormat} onOpen={open("asset")} />
      <LiabilitiesTable liabilities={plan.liabilities} currency={currency} numberFormat={numberFormat} onOpen={open("liability")} />
      <IncomesTable incomes={plan.incomes} currency={currency} numberFormat={numberFormat} onOpen={open("income")} />
      <ExpensesTable expenses={plan.expenses} currency={currency} numberFormat={numberFormat} onOpen={open("expense")} />
      <EventsTable events={plan.events} currency={currency} numberFormat={numberFormat} onOpen={open("event")} />

      <PlanDrawer open={target !== undefined} eyebrow={eyebrow} title={title} onClose={close} onRemove={onRemove}>
        {asset ? <AssetFields asset={asset} /> : null}
        {liability ? <LiabilityFields liability={liability} /> : null}
        {income ? <IncomeFields income={income} /> : null}
        {expense ? <ExpenseFields expense={expense} /> : null}
        {event ? <EventFields event={event} /> : null}
      </PlanDrawer>
    </Shell>
  );
}
```

(Tasks 4 & 5 add the other four `*Fields` exports + convert their tables. Until then, `pnpm typecheck` will error on the missing imports — that's expected; this task's gate is just that AssetsTable/PlanDrawer/PlanView compile against the asset path. To keep Task 3 independently green, temporarily stub the four not-yet-built tables' new props: skip — instead, do Tasks 3–5 as one reviewer gate. **Adjust: Task 3 ends at `pnpm test -- PlanDrawer` + the asset files written; full typecheck passes only after Task 5.** See note below.)

> **Sequencing note:** Tasks 3–5 together form the table/drawer conversion; `pnpm typecheck` only goes green once all five tables expose `{currency,numberFormat,onOpen}` and their `*Fields`. Implement 3 → 4 → 5 back-to-back; run `pnpm typecheck && pnpm lint` at the **end of Task 5**. Within Task 3, verify the asset files and `PlanDrawer` test pass (`pnpm test -- PlanDrawer`).

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/SummaryRow.tsx src/app/plan/AssetsTable.tsx src/app/plan/PlanView.tsx src/app/plan/serialized.ts src/app/plan/page.tsx src/lib/plan/schemas.ts src/app/plan/actions.ts
git commit -m "feat(plan): summary rows + asset drawer form + PlanView selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Income + Expense drawer forms + summary tables

**Files:**
- Modify: `src/app/plan/IncomesTable.tsx`
- Modify: `src/app/plan/ExpensesTable.tsx`

**Interfaces:**
- Produces: `IncomeFields({ income })` + `IncomesTable({ incomes, currency, numberFormat, onOpen })`; `ExpenseFields({ expense })` + `ExpensesTable({ expenses, currency, numberFormat, onOpen })`.

- [ ] **Step 1: Rewrite `IncomesTable.tsx`**

Replace `src/app/plan/IncomesTable.tsx` with (Panel/Heading/Empty/Err styled as in `AssetsTable.tsx`):

```tsx
// src/app/plan/IncomesTable.tsx
"use client";

import type { IncomeKind } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "./PlanDrawer";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanIncome, updatePlanIncome } from "./actions";
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
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

export function IncomeFields({ income }: { income: SerializedPlanIncome }) {
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

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell value={income.label} onCommit={(v) => save({ ...income, label: v })} />
        </Field>
        <Field label="Kind">
          <SelectCell value={income.kind} options={INCOME_KINDS} onCommit={(v) => save({ ...income, kind: v })} />
        </Field>
        <Field label="Amount /yr">
          <NumberCell value={income.annualAmount} onCommit={(v) => save({ ...income, annualAmount: v ?? income.annualAmount })} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Timing">
        <Field label="Start age (blank = from now)">
          <NumberCell value={income.startAge} nullable onCommit={(v) => save({ ...income, startAge: v })} />
        </Field>
        <Field label="End age (blank = end of plan)">
          <NumberCell value={income.endAge} nullable onCommit={(v) => save({ ...income, endAge: v })} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Growth">
        <Field label="Grows by">
          <SelectCell value={income.growthKind} options={GROWTH_KINDS} onCommit={(v) => save({ ...income, growthKind: v })} />
        </Field>
        {income.growthKind === "FIXED" ? (
          <Field label="Fixed growth %">
            <NumberCell value={income.growthPct} nullable step="0.1" onCommit={(v) => save({ ...income, growthPct: v })} />
          </Field>
        ) : null}
      </DrawerSection>
      <DrawerSection title="Tax">
        <Field label="Taxable">
          <BoolCell value={income.taxable} onCommit={(v) => save({ ...income, taxable: v })} />
        </Field>
      </DrawerSection>
    </>
  );
}

export function IncomesTable({
  incomes,
  currency,
  numberFormat,
  onOpen,
}: {
  incomes: SerializedPlanIncome[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanIncome();
    router.refresh();
    onOpen(id);
  };
  const span = (i: SerializedPlanIncome) =>
    `age ${i.startAge ?? "now"}→${i.endAge ?? "end"}`;

  return (
    <Panel>
      <Heading>Income</Heading>
      {incomes.length === 0 ? (
        <Empty>No income yet.</Empty>
      ) : (
        <SummaryList>
          {incomes.map((i) => (
            <SummaryRow
              key={i.id}
              primary={i.label}
              secondary={`${formatAmount(currency, i.annualAmount, numberFormat)}/yr · ${span(i)}`}
              onOpen={() => onOpen(i.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add income" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 2: Rewrite `ExpensesTable.tsx`**

Replace `src/app/plan/ExpensesTable.tsx` with (same Panel/Heading/Empty/Err styled block as IncomesTable):

```tsx
// src/app/plan/ExpensesTable.tsx
"use client";

import type { ExpenseCategory } from "@/lib/plan";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "./PlanDrawer";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanExpense, updatePlanExpense } from "./actions";
import type { SerializedPlanExpense } from "./serialized";

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["FIXED", "VARIABLE", "DISCRETIONARY"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

export function ExpenseFields({ expense }: { expense: SerializedPlanExpense }) {
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

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell value={expense.label} onCommit={(v) => save({ ...expense, label: v })} />
        </Field>
        <Field label="Category">
          <SelectCell value={expense.category} options={EXPENSE_CATEGORIES} onCommit={(v) => save({ ...expense, category: v })} />
        </Field>
        <Field label="Amount /yr">
          <NumberCell value={expense.annualAmount} onCommit={(v) => save({ ...expense, annualAmount: v ?? expense.annualAmount })} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Timing">
        <Field label="Start age (blank = from now)">
          <NumberCell value={expense.startAge} nullable onCommit={(v) => save({ ...expense, startAge: v })} />
        </Field>
        <Field label="End age (blank = end of plan)">
          <NumberCell value={expense.endAge} nullable onCommit={(v) => save({ ...expense, endAge: v })} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Inflation">
        <Field label="Inflation-linked">
          <BoolCell value={expense.inflationLinked} onCommit={(v) => save({ ...expense, inflationLinked: v })} />
        </Field>
      </DrawerSection>
    </>
  );
}

export function ExpensesTable({
  expenses,
  currency,
  numberFormat,
  onOpen,
}: {
  expenses: SerializedPlanExpense[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanExpense();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Expenses</Heading>
      {expenses.length === 0 ? (
        <Empty>No expenses yet.</Empty>
      ) : (
        <SummaryList>
          {expenses.map((e) => (
            <SummaryRow
              key={e.id}
              primary={e.label}
              secondary={`${e.category} · ${formatAmount(currency, e.annualAmount, numberFormat)}/yr`}
              onOpen={() => onOpen(e.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add expense" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/plan/IncomesTable.tsx src/app/plan/ExpensesTable.tsx
git commit -m "feat(plan): income + expense drawer forms + summary tables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Liability + Event forms + summary tables; full typecheck/lint green

**Files:**
- Modify: `src/app/plan/LiabilitiesTable.tsx`
- Modify: `src/app/plan/EventsTable.tsx`

**Interfaces:**
- Produces: `LiabilityFields({ liability })` + `LiabilitiesTable({ liabilities, currency, numberFormat, onOpen })`; `EventFields({ event })` + `EventsTable({ events, currency, numberFormat, onOpen })`.

- [ ] **Step 1: Rewrite `LiabilitiesTable.tsx`**

Replace `src/app/plan/LiabilitiesTable.tsx` with (same Panel/Heading/Empty/Err styled block):

```tsx
// src/app/plan/LiabilitiesTable.tsx
"use client";

import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "./PlanDrawer";
import { NumberCell, TextCell } from "./EditableCell";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanLiability, updatePlanLiability } from "./actions";
import type { SerializedPlanLiability } from "./serialized";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

export function LiabilityFields({ liability }: { liability: SerializedPlanLiability }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanLiability) => {
    setError(null);
    try {
      await updatePlanLiability({
        liabilityId: next.id,
        label: next.label,
        openingBalance: next.openingBalance,
        interestPct: next.interestPct,
        monthlyRepayment: next.monthlyRepayment,
        endAge: next.endAge,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell value={liability.label} onCommit={(v) => save({ ...liability, label: v })} />
        </Field>
        <Field label="Balance">
          <NumberCell value={liability.openingBalance} onCommit={(v) => save({ ...liability, openingBalance: v ?? liability.openingBalance })} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Terms">
        <Field label="Interest %">
          <NumberCell value={liability.interestPct} step="0.1" onCommit={(v) => save({ ...liability, interestPct: v ?? liability.interestPct })} />
        </Field>
        <Field label="Repayment /mo">
          <NumberCell value={liability.monthlyRepayment} onCommit={(v) => save({ ...liability, monthlyRepayment: v ?? liability.monthlyRepayment })} />
        </Field>
        <Field label="Paid off by age (blank = none)">
          <NumberCell value={liability.endAge} nullable onCommit={(v) => save({ ...liability, endAge: v })} />
        </Field>
      </DrawerSection>
    </>
  );
}

export function LiabilitiesTable({
  liabilities,
  currency,
  numberFormat,
  onOpen,
}: {
  liabilities: SerializedPlanLiability[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanLiability();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>Liabilities</Heading>
      {liabilities.length === 0 ? (
        <Empty>No liabilities yet.</Empty>
      ) : (
        <SummaryList>
          {liabilities.map((l) => (
            <SummaryRow
              key={l.id}
              primary={l.label}
              secondary={`${formatAmount(currency, l.openingBalance, numberFormat)} · ${l.interestPct}%`}
              onOpen={() => onOpen(l.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add liability" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 2: Rewrite `EventsTable.tsx`**

Replace `src/app/plan/EventsTable.tsx` with (same styled block):

```tsx
// src/app/plan/EventsTable.tsx
"use client";

import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { DrawerSection, Field } from "./PlanDrawer";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanEvent, updatePlanEvent } from "./actions";
import type { EventDirection, SerializedPlanEvent } from "./serialized";

const DIRECTIONS: EventDirection[] = ["INFLOW", "OUTFLOW"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

export function EventFields({ event }: { event: SerializedPlanEvent }) {
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

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell value={event.label} onCommit={(v) => save({ ...event, label: v })} />
        </Field>
        <Field label="Age">
          <NumberCell value={event.age} onCommit={(v) => save({ ...event, age: v ?? event.age })} />
        </Field>
        <Field label="Direction">
          <SelectCell value={event.direction} options={DIRECTIONS} onCommit={(v) => save({ ...event, direction: v })} />
        </Field>
        <Field label="Amount">
          <NumberCell value={event.amount} onCommit={(v) => save({ ...event, amount: v ?? event.amount })} />
        </Field>
      </DrawerSection>
    </>
  );
}

export function EventsTable({
  events,
  currency,
  numberFormat,
  onOpen,
}: {
  events: SerializedPlanEvent[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanEvent();
    router.refresh();
    onOpen(id);
  };

  return (
    <Panel>
      <Heading>One-off events</Heading>
      {events.length === 0 ? (
        <Empty>No events yet.</Empty>
      ) : (
        <SummaryList>
          {events.map((ev) => (
            <SummaryRow
              key={ev.id}
              primary={ev.label}
              secondary={`age ${ev.age} · ${ev.direction === "INFLOW" ? "+" : "−"}${formatAmount(currency, ev.amount, numberFormat)}`}
              onOpen={() => onOpen(ev.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add event" onAdd={add} />
    </Panel>
  );
}
```

- [ ] **Step 3: Full typecheck + lint + unit (whole conversion now compiles)**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean; 268 unit + the 3 new PlanDrawer tests pass. (`RowControls`/`EditableCell` no longer used by the tables for rows, but are still used — `RowControls.AddRowButton` by the tables, `RowControls.RemoveCell` by `PlanDrawer`, `EditableCell` by the forms — so no orphaned-import lint errors. If lint flags an unused import in any rewritten table, remove it.)

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/LiabilitiesTable.tsx src/app/plan/EventsTable.tsx
git commit -m "feat(plan): liability + event drawer forms + summary tables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: E2E rework — drive editing through the drawer

**Files:**
- Modify: `e2e/plan.spec.ts`

**Interfaces:**
- Consumes: the wired `/plan` (Tasks 3–5). Editing now happens in the drawer; rows are summary buttons.

- [ ] **Step 1: Replace the inline-edit + CRUD steps with drawer-driven steps**

In `e2e/plan.spec.ts`, the create-plan + render assertions (heading "Your plan", svg, legend "OTHER") stay. **Replace** the old inline asset-edit block (the `assetRow`/`valueCell`/`wrapper` `select` interactions and the data-loss guard) and the 2a inline CRUD block with drawer-driven equivalents. The seeded asset is the only asset row; open it, edit in the drawer:

```ts
  // Open the seeded asset's drawer (summary row → dialog).
  const assetPanel = page.locator("section", { hasText: "Assets" });
  await assetPanel.getByRole("button", { name: /SIPP/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  // Change the wrapper OTHER → PENSION inside the drawer; chart legend recolours.
  const wrapper = drawer.locator("select").first();
  await expect(wrapper).toHaveValue("OTHER");
  await wrapper.selectOption("PENSION");
  await expect(page.locator(".recharts-legend-wrapper")).toContainText("PENSION");

  // Data-loss guard inside the drawer: clear the required Value, blur → reverts.
  const valueCell = drawer.locator("input[type='number']").first();
  await expect(valueCell).toHaveValue("100000");
  await valueCell.fill("");
  await valueCell.blur();
  await expect(valueCell).toHaveValue("100000");

  // Close the drawer (Escape).
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();

  // Add an income → its drawer opens ready to edit; edit the label; confirm-remove.
  const incomePanel = page.locator("section", { hasText: "Income" });
  await incomePanel.getByRole("button", { name: "+ Add income" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const incomeLabel = page.getByRole("dialog").locator("input[type='text']").first();
  await expect(incomeLabel).toHaveValue("New income");
  await incomeLabel.fill("Freelance");
  await incomeLabel.blur();
  await expect(incomeLabel).toHaveValue("Freelance");
  await page.getByRole("dialog").getByRole("button", { name: /^remove$/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /yes/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
```

Keep the existing **switcher** (Net worth / Cash flow / Liquid assets) and **Timeline** assertions as they are (they don't touch editing). Keep the final screenshot.

- [ ] **Step 2: Run the e2e**

Run: `docker compose up -d db && PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"`
Expected: PASS — the asset drawer opens, wrapper edit recolours the chart, the data-loss guard holds in the drawer, add-income opens its drawer, and confirm-remove closes it.

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): drive plan editing through the detail drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `docker compose up -d db && pnpm verify` (typecheck + biome ci + unit) passes.
- [ ] `pnpm test:int` passes (incl. the create-returns-id assertion).
- [ ] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"` passes.
- [ ] Live browser check (verify skill): click each element type → its drawer opens with grouped sections; edit a field → chart/timeline update live behind the drawer; Add opens the new row's drawer; confirm-Remove in the footer; Esc/scrim/✕ all close; keyboard-only pass (focus enters the drawer, returns to the row on close).

## Notes

- Inline editing and per-row Remove are gone; the row is a summary that opens the drawer, and Remove lives in the drawer footer.
- `RemoveCell` (confirm-first) and `AddRowButton` from `RowControls` are reused; `EditableCell` controls are reused inside the forms (unchanged).
- Selection survives `router.refresh()` (client state) and is re-resolved by id each render, so the drawer shows committed values after each edit; a removed element resolves to `undefined` → drawer closes.
- Assumptions panel and the charts/timeline are untouched.

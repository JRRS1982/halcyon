# Life Planning — Phase D1: Master-detail editing drawer

**Date:** 2026-06-23
**Status:** Design — approved for planning
**Predecessors:** 2a editing CRUD (#67), 2b charts (#62), 2c timeline (#68), presentation polish (#69)
**Branch:** `feat/plan-editing-drawer`

## 1. Context & goal

The five plan collections are edited today through inline table cells (Phase 2a). That works for a handful of fields but doesn't scale — each element will grow far more detail (contribution schedules, fees, return bands, richer timing), and a wide table is unusable. This phase reshapes the editing UX into **master → detail**: the tables become compact summary rows, and clicking a row opens a **right-hand slide-out drawer** holding that element's full settings, grouped with progressive disclosure. The drawer leaves the chart/timeline visible so the projection updates live as you edit (the chosen pattern over a centred modal, for exactly this reason).

**This is the architecture slice (D1).** It re-homes the *current* fields into the drawer with no engine or schema change, and surfaces the one already-supported-but-hidden field (asset **contribute-until-age**). Genuinely new fields (fees, return band, escalation, drawdown rules) are follow-on slices (D2+), each adding a Prisma migration + engine support.

## 2. Scope & non-goals

In scope:
- A shared **slide-out drawer** shell with sectioned, collapsible content.
- Per-element **field forms** for asset / liability / income / expense / event, reusing the existing controlled cells and `updatePlan*` actions.
- The five tables become **summary lists** (read-only rows + `+ Add`); clicking a row opens the drawer; **Remove moves into the drawer footer**.
- **Add opens the new element's drawer** ready to configure.
- Expose the asset **contribute-until-age** field (engine already supports `contributionEndAge`, default = retirement).

Non-goals:
- **No engine/schema/migration change.** The only server-side change is `createPlan*` returning the new row's id (return value only — see §6).
- New attributes (fees, return band, escalation, drawdown rules, date/event-based timing) — D2+.
- The **Assumptions** panel stays as-is (a plan-level singleton, not a collection) — not drawerised.
- `linkedAssetId` on liabilities stays hidden (currently inert in the engine).

## 3. The pattern

```
 list (master)                 drawer (detail)
 ┌─────────────────────┐       ┌──────────────────────────┐
 │ Assets        + Add │       │ STOCKS & SHARES ISA    ✕  │
 │ ─────────────────── │       │ ── Basics ─────────────── │
 │ ISA   £7,400   ›  ●──┼──────▶│  Label / Type / Value     │
 │ SIPP  £22,550  ›    │       │ ── Growth ▸ (collapsed)   │
 │ Cash  £3,160   ›    │       │ ── Contributions ▸        │
 └─────────────────────┘       │ ── Drawdown ▸             │
        chart stays visible ◀──┤ live · Remove             │
                                └──────────────────────────┘
```

## 4. Components

### `PlanDrawer.tsx` (new) — the shell
- A right-docked sheet (`width: min(460px, 94vw)`, full-height sheet on mobile) over a light scrim; the chart/timeline remain visible to its left.
- Open iff a selection exists; closes on the **✕ button**, **scrim click**, and **Esc**.
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title; on open move focus into the drawer; **Tab is trapped** within the drawer; on close, focus returns to the row that opened it.
- Locks body scroll while open; respects `prefers-reduced-motion` (no transform transition).
- Header (eyebrow + title + ✕), scrollable body (the field form), footer (live-update note + confirm-first **Remove**).
- Switches on the selection's `kind` to render the matching field form.
- Exposes a small `DrawerSection` (collapsible group: header button with chevron + body; `defaultOpen` prop).

### Per-element field forms (new) — `AssetFields` / `LiabilityFields` / `IncomeFields` / `ExpenseFields` / `EventFields`
Each is co-located in its existing `*Table.tsx` file (keeps a collection's summary + editor together) and exported for `PlanDrawer` to render. Each owns a `save(next)` that mirrors the current 2a row save (build the full `updatePlan*` input from the element spread with the changed field → `updatePlanX` → `router.refresh()`; catch → set an error shown in the drawer → rethrow so the cell reverts). Fields use the existing `NumberCell`/`SelectCell`/`TextCell`/`BoolCell`, laid out in `DrawerSection`s:

| Element | Basics (open) | Other sections (collapsed) |
| --- | --- | --- |
| **Asset** | label, wrapper, value | **Growth**: return % · **Contributions**: amount/yr, **contribute until age** (nullable; blank = retirement) · **Drawdown**: order |
| **Income** | label, kind, amount/yr | **Timing**: start age, end age (nullable; helper text "blank = from now / to end of plan") · **Growth**: kind + % (when Fixed) · **Tax**: taxable |
| **Expense** | label, category, amount/yr | **Timing**: start age, end age · **Inflation**: inflation-linked |
| **Liability** | label, balance | **Terms**: interest %, repayment/mo, end age |
| **Event** | label, age, direction, amount | — |

### The five tables → summary lists (`*Table.tsx`, edited)
- Render read-only **summary rows** + the `+ Add` button. Each row is a button/clickable element (keyboard-focusable, `aria-haspopup="dialog"`) calling `onOpen(kind, id)`; shows a chevron.
- Summary content (formatted via `currency`/`numberFormat`, newly passed in):
  - **Asset:** `{label}` — wrapper · value · (`+£contrib/yr` if any)
  - **Liability:** `{label}` — balance · `interest%`
  - **Income:** `{label}` — `amount/yr` · `age {start ?? "now"}→{end ?? "end"}`
  - **Expense:** `{label}` — category · `amount/yr`
  - **Event:** `{label}` — `age {age}` · direction · amount
- The per-row inline editing and per-row Remove are **removed** (editing + Remove now live in the drawer). The empty-state hint and `+ Add` stay.

### `PlanView.tsx` (edited)
- Holds selection state: `const [selected, setSelected] = useState<{ kind: ElementKind; id: string } | null>(null)`.
- Passes `onOpen` to each table and `currency`/`numberFormat` for summaries.
- Each render, **resolves** the selected element from the current serialized collections by id; if absent (e.g. just removed), treats as closed.
- Renders **one** `<PlanDrawer selected={resolved} onClose={() => setSelected(null)} currency={…} numberFormat={…} />`.

## 5. State & data flow

`router.refresh()` is a soft refresh — it re-renders server components while **preserving client state**, so `selected` (kind + id) survives an edit; PlanView re-resolves the element from the refreshed data so the drawer shows committed values and the chart/verdict/timeline recompute (the established 2a/2b convention). On Remove → `deletePlan*` → `setSelected(null)` (close) → refresh; the row disappears.

## 6. Server actions (`actions.ts`)

Only change: **`createPlan*` return the new row's id** (`Promise<void>` → `Promise<string>`) so Add can open it reliably. No other action change; `updatePlan*`/`deletePlan*` unchanged. The add flow: `const id = await createPlanAsset(); router.refresh(); onOpen("asset", id);` — after the refresh the new element is in PlanView's data and the drawer resolves it. (This replaces the racy "re-select highest sortOrder" idea: reading data right after `router.refresh()` would see the pre-add snapshot.)

## 7. Error handling

Same contract as 2a: each `save`/`remove` catches, surfaces an inline error **inside the drawer**, and rethrows so the controlled cell reverts to the persisted value. zod validation is unchanged (the same `updatePlan*` schemas). Required `NumberCell`s keep the data-loss guard (cleared required field reverts, never persists 0).

## 8. Testing

- **Unit (RTL, jsdom), `PlanDrawer.test.tsx`:** opens when given a selection; closes via ✕, scrim click, and Esc (calls `onClose`); a `DrawerSection` toggles; focus moves into the drawer on open. (The field forms reuse `EditableCell`, already unit-tested; their save logic is exercised by the e2e + the existing 2a integration tests for `updatePlan*`, which are unchanged.)
- **Integration:** unchanged — `crudActions.int.test.ts` already covers `createPlan*`/`updatePlan*`/`deletePlan*`; add an assertion that `createPlanAsset()` (and one other) returns a non-empty id.
- **E2E (`e2e/plan.spec.ts`, reworked):** the current inline-edit steps move to the drawer — click the asset summary row → drawer opens → change wrapper (chart legend recolours OTHER→PENSION) → the data-loss guard on the value field (cleared → reverts) → confirm-Remove in the drawer footer. Plus: `+ Add income` opens the new row's drawer; the timeline/switcher assertions stay. (This rewrites the editing portion of the spec that 2a/2b/2c built; the chart/timeline/switcher coverage is retained.)

## 9. Decomposition (one plan)

~6 tasks: (1) `createPlan*` return id + int assertion; (2) `PlanDrawer` shell (+ `DrawerSection`) + RTL; (3) selection state + `PlanView` wiring + one element's fields end-to-end (asset) as the vertical slice; (4) remaining field forms (liability/income/expense/event); (5) tables → summary rows + Add-opens-drawer + Remove-in-footer; (6) e2e rework. Each independently testable.

## 10. Risks / edge cases

- **Selection survives refresh** because it's keyed by id and re-resolved each render; a removed element resolves to null → drawer closes. Verified-by-design via the soft-refresh behaviour relied on since 2a.
- **Focus trap / scroll lock** are the fiddly bits — covered by the `PlanDrawer` RTL tests and a manual a11y pass (keyboard-only open/edit/close).
- **E2E rewrite** is the largest ripple: the inline-edit assertions are replaced by drawer-driven ones; the chart/timeline/switcher assertions are preserved.
- **Mobile:** the drawer is a full-width sheet; the "watch the chart while editing" benefit is desktop-only, which is acceptable (degrades gracefully).
- The drawer is a **single instance** in `PlanView` (not one-per-row), so there's no duplication and one place owns open/close/focus.

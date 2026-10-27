# Plan sync: one button makes the plan match reality

**What:** Sync replaces plan row labels, values, and which rows exist to match current accounts and budget categories — preserving all user-set assumptions.  
**Key points:**
- Each plan row carries `accountId` or `categoryId`; Sync adds rows for new accounts/categories and removes rows for deleted ones
- `monthlyContribution` and `monthlyRepayment` (both monthly £) are written by Sync from budget transfers/repayments
- Values and labels are replaced; expected return, fees, and other assumptions are kept unchanged
- Creating a plan for the first time is a Sync against an empty plan

Each plan row carries a durable, nullable link to the thing it mirrors:
`accountId` on `PlanAsset` and `PlanLiability`, `categoryId` on `PlanIncome` and
`PlanExpense`. The **Sync** button on `/plan` re-reads the balance sheet and the
budget and makes the plan agree with them.

See [the design doc](../superpowers/specs/2026-08-25-plan-sync-design.md) for the
history and [`accounts.md`](accounts.md) for the `Account` registry this builds
on. This doc describes what the code does today; where the two disagree, the
design doc is the historical record.

## The one rule

> Sync makes the plan's rows and values match what the balance sheet and
> budget currently say. Everything else the plan holds survives.

| | |
|---|---|
| **Replaced** | opening values, annual amounts, labels, an asset's wrapper, the budgeted flow into an account (an asset's monthly contribution, a liability's monthly repayment), every `AccountTerms` parameter the account has (expected return, fees, min access age, a final-salary entitlement and the age it starts paying, interest rate, interest-only, a mortgage's revision rate and age, an end age), and *which rows exist* |
| **Kept** | drawdown priority, contribution end age, growth kind, taxable flag, start/end ages on income/expense rows, retirement age, inflation, return spread, tax regime, inflation-linked thresholds, state pension, and every `PlanEvent` **except** a `PROPERTY_SALE` whose property is being removed |
| **Removed** | rows whose link is null (plan-only), rows whose account or category is gone — archived or hard-deleted alike — and everything that cannot outlive one of those: a property's mortgage, a mortgage's repayment expense, a property's sale events |

One press, decided by `resolvePlanSync`
([`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts)):

1. **Updates** every linked row whose value, label, wrapper or budgeted flow
   differs from the latest observation.
2. **Adds** a row for anything on the balance sheet or budget the plan lacks
   (subject to the zero-value guard, below).
3. **Removes** rows whose account or category no longer exists. "Stop
   tracking" means the user no longer has the thing, so the plan must stop
   projecting it. Historical `BalanceItem` rows are untouched, so charts are
   unaffected.
4. **Removes** plan-only rows — those with a null link.
5. **Removes** whatever cannot outlive any of the above — see *Removal is
   complete*, below.
6. **Preserves** assumptions on every surviving row, matched by its link
   rather than its position.

A user who has picked a drawdown priority, or ended a synced salary at
retirement, keeps it: neither is read off the account or the budget.

Matching is by **kind *and* link id** (`keyOf` builds `ASSET::<uuid>`). An
account id and a category id could collide, and an asset row must never
resolve against an income — kind is part of the identity, not a filter.

### The compare set: fourteen fields

`resolvePlanSync` calls a row unchanged only when `value`, `label`, `wrapper` and
`flow` match reality and so do the ten fields of `RowTerms`
([`rowTerms.ts`](../../src/lib/plan/rowTerms.ts)), compared by `rowTermsEqual`. A
changed interest rate or a newly-ticked interest-only flag makes a mortgage row
report `●` exactly as a changed balance does: a term is a projection input.

`RowTerms` has more fields than `AccountTerms` has columns because `endDate` is
one column with two destinations, chosen by kind (see "`endDate` means two
different things," below).

Two things keep the wide compare from reporting "changed forever":

1. **Dates convert to ages before comparison.** `AccountTerms.revisionDate` and
   `.endDate` are dates; the plan stores `revisionAge` and `endAge`. A date
   never equals an age, so every mortgage would show as changed on every Sync.
   `ageOnDate(dateOfBirth, date)` converts on the reality side, in
   [`reality.ts`](../../src/lib/plan/reality.ts), so `RowTerms` holds no date.
2. **`TERM_COMPARE_KEYS` is derived from an exhaustiveness pin.** `rowTerms.ts`
   defines `ALL_TERM_KEYS` as `satisfies Record<keyof RowTerms, true>` and
   derives the comparison array from its keys. Adding a field to `RowTerms`
   without adding it there is a compile error (`TS1360`). A hand-written
   `[...] as const satisfies readonly (keyof RowTerms)[]` looks equivalent and is
   not: it only checks that the listed keys are valid, so a forgotten field
   compiles and is never compared.

Two more failure modes are gated per field:

- **`PlanAsset.feePct` and `PlanLiability.interestPct` are `NOT NULL`,
  defaulting to `0`.** An account with no `AccountTerms` row has a true `0`, not
  an unknown `null`. Reading `null` would never equal the column's `0`.
  `reality.ts` reads `0` for these two, gated to the kind each belongs to.
- **Every parameter is gated on what the account's own type prompts for.**
  `reality.ts` reads a parameter only if `termsFor(account.type)` lists it,
  and otherwise reads the neutral value the plan column holds —
  `null`, or `0`/`false` for the three `NOT NULL` columns — matching
  `toLoadedPlan`'s own hard-coded values exactly. So an asset-only parameter
  (`expectedReturnPct`, `feePct`, `minAccessAge`, `annualIncome`,
  `incomeFromAge`) never travels on a `LIABILITY` row, a liability-only one
  (`interestPct`, `interestOnly`, `revisionRate`, `revisionAge`, `endAge`)
  never travels on an `ASSET` one, **and neither does a parameter belonging to
  a different type of the same kind.**

  That last case is why the gate is `termsFor` rather than `kindOf`. Nothing in
  the schema stops `AccountTerms` holding a parameter its account's type does
  not prompt for (no CHECK constraint), and `setAccountType` deliberately does
  **not** delete terms when the type changes. So a pension misfiled as
  `FINAL_SALARY`, given an `annualIncome` and an `endDate`, then corrected to
  `SIPP` keeps both, and no SIPP card renders them to clear. Gated on kind
  alone, Sync would copy that entitlement onto the SIPP's plan row, zeroing its
  balance every year and paying a phantom income. The same holds for
  `MORTGAGE → LOAN` (a stranded `interestOnly`) and `MORTGAGE → CREDIT_CARD` (a
  stranded `endAge`).

  Two layers, because neither is sufficient alone:

  - **The door.** `setAccountTerms` and `createAccount` refuse any parameter the
    account's type does not prompt for (`disallowedTerms` in
    [`schemas.ts`](../../src/lib/accounts/schemas.ts)), reading the type from the
    row, not the payload.
  - **The safety net.** The `termsFor` gate in `reality.ts` makes an
    already-stranded value (the type-change case, which no door can prevent)
    inert.

### `endDate` means two different things, chosen by kind

`AccountTerms.endDate` is one column serving two purposes:

- On a **liability**, it's the date the balance is repaid — converted to
  `PlanLiability.endAge`.
- On `FINAL_SALARY`, it's the date the pot converts to an income instead —
  converted to `PlanAsset.incomeFromAge`, a dedicated column, because
  `endAge` exists only on `PlanLiability`.

Once `annualIncome` is set on a final-salary asset, its balance stops
contributing to the projection — `project.ts` zeroes it every year rather
than growing or drawing it down — and an income of that amount runs from
`incomeFromAge` to the end of the plan, tagged `DB_PENSION`
([`streams.ts`](../../src/lib/plan/streams.ts)). People track a defined-benefit pension's transfer value on their balance sheet,
so an account can carry both a balance *and* an entitlement. Projecting the pot
and paying the income would count the pension twice. The fence keys on `annualIncome`, not on the
`DB_PENSION` wrapper, so an asset with no entitlement is unaffected even if it
happens to carry that wrapper.

It keys on a **positive** `annualIncome` (`isEntitled` in
[`assets.ts`](../../src/lib/plan/assets.ts)), not merely a set one. Blank and `0`
look identical in the input but `0` means "I don't know yet"; read as an
entitlement it would drop the pot from net worth and pay nothing.

### Contributions are stored monthly

`PlanAsset.monthlyContribution` is stored monthly, and the annual figure shown is
derived for display, never editable: an editable annual field would divide by 12
on the way in, and £10,000 would round-trip to £9,999.96. The read-out shows
£9,999.96 for £833.33/mo because that is what twelve payments come to. Both flow
columns being monthly also means no cross-unit multiply in `reality.ts` to round.

### The plan's own bounds are the column's, not a judgement about plausibility

`applySyncPlan` writes through Prisma, bypassing zod. So every quantity a Sync
copies from an account must be inside the bounds
[`plan/schemas.ts`](../../src/lib/plan/schemas.ts) puts on a *manual* edit of that
row. Otherwise Sync writes a figure the row's own editor rejects, and **every
later edit of that row throws**.

Real figures are wider than what a person types by hand: a UK overdraft charges
39.9%, a mortgage can clear before 40, a protected pension age can be 45. So the
plan-side bounds match the account side's (`DECIMAL(5,2)`, ±999.99; see
`accountTermsSchema`). Sync does **not** clamp, since that would alter a rate the
user really pays. `PlanAsset.openingValue` and `PlanLiability.openingBalance` are
unbounded like `BalanceItem.value` (an overdrawn current account is an asset with
a negative balance), and the Sync-written ages `endAge` and `revisionAge` carry no
range, because a date input accepts any year. `monthlyContribution` and
`monthlyRepayment` keep `min(0)`, as the budget rows feeding them are
`nonnegative()`.

### Contributions and repayments are Replaced, not Kept

`PlanAsset.monthlyContribution` and `PlanLiability.monthlyRepayment` are fed by
the budget's `TRANSFER` and `REPAYMENT` rows (see
[`budget-transfers.md`](budget-transfers.md)). They cannot be both Kept and fed.
"A null flow means leave it alone" was rejected because it can never **clear** a
contribution once its budget row is deleted.

> **Consequence.** A hand-typed mortgage repayment with no matching `REPAYMENT`
> budget row **resets to 0 on the next Sync.**

It is not silent: the row carries a `●` first and the button counts it. Nothing
on screen says *why*; the fix is to add the matching budget row.

## Removal is complete

A mortgaged property is four rows that cannot stand apart: the property
`PlanAsset`, the `PlanLiability` that names it through `linkedAssetId`, the
repayment `PlanExpense` that liability manages through `liabilityId`, and any
`PROPERTY_SALE` `PlanEvent` pointing at the property through `assetId`.
Removing only the row reality lost would leave a mortgage on a house that is
gone, or a **zombie** sale event whose `assetId` the FK nulled: `project.ts`
skips it in three places, `schemas.ts` refuses to save an edit to it, and
`EventsTable` renders it as a sale of `"?"`.

`deletePlanAsset` enforces the same invariant on the plan's own delete,
cascading to the linked mortgage and its repayment expense, and
`deletePlanLiability` does the same for the repayment. Sync matches them. It does
not match `deletePlanExpense`'s refusal to delete a repayment on its own, nor does
`deletePlanAsset` take sale events (see *Known gaps*).

The dependency reaches the resolver **as data**, never as a query inside the
action: `PlanRow.dependsOn` carries the id of the row it cannot outlive
(`PlanLiability.linkedAssetId`, `PlanExpense.liabilityId`), and events — which
are not `PlanRow`s, since they mirror nothing on the balance sheet — arrive as
`DependentRow[]`. `resolvePlanSync` then walks the closure **transitively**:
property → mortgage → repayment is three deep, and a hand-rolled two levels
would leave the third behind. The walk is breadth-first over the `removals` array, which is both queue and result.

Three properties fall out of doing it there rather than in the action:

- **Nothing is removed or counted twice.** A repayment expense is *both*
  plan-only (`linkRepaymentExpense` sets no `categoryId`) and dragged by its
  mortgage. An id already in `removals` is never added again, so it is deleted
  once, listed once, and counted once.
- **A dragged row leaves `updates` and `unchanged`.** It was classified against
  reality before the cascade reached it. Left in `updates` it would be counted
  twice in the breakdown and written by `applySyncPlan` immediately before
  being deleted.
- **`syncChangeCount` stays truthful.** Cascades are removals like any other,
  so the button's number is exactly what the action writes. It is *not* the
  number the dialog lists: `"gone"` rows are counted but never named, having
  already been confirmed at the balance sheet. Archive a house carrying a
  mortgage, its repayment and a sale event and the button reads `4 removed`
  while the dialog names the 3 attached rows — the house appears only as the
  thing they go with. Both numbers come from the one `SyncPlan`, so they
  cannot drift; they answer different questions.

**A dragged row whose own account is still live comes back on the next press.**
A mortgage removed because its property went, while its own account is still on
the balance sheet, returns as a standalone liability with default assumptions.
The debt still exists, so that is honest. Archiving both halves, which is what
selling a house means, avoids it.

## Where the numbers come from

| Plan row | Source |
|---|---|
| `PlanAsset.openingValue` | latest `BalanceItem.value` for the account |
| `PlanLiability.openingBalance` | latest `BalanceItem.value` for the account |
| `PlanIncome.annualAmount` | latest `BudgetItem.budget` **× 12** for the category |
| `PlanExpense.annualAmount` | latest `BudgetItem.budget` **× 12** for the category |
| `PlanAsset.monthlyContribution` | latest `TRANSFER` `INFLOW` `BudgetItem.budget` for the account, **as stored** |
| `PlanLiability.monthlyRepayment` | latest `REPAYMENT` `BudgetItem.budget` for the account, **as stored** |
| `PlanAsset`/`PlanLiability` term fields (`expectedReturnPct`, `feePct`, `minAccessAge`, `annualIncome`, `incomeFromAge`, `interestPct`, `interestOnly`, `revisionRate`, `revisionAge`, `endAge`) | the account's `AccountTerms` row, converted to plan units by `reality.ts` — dates to ages, a missing row to `0`/`null`/`false` per column. See "The compare set," above |

Read by `latestReality` ([`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts)),
one row per live account and per live budget category:

- **"Latest" is not "this month".** It is the most recent non-deleted period
  that has a row for that account or category — a user may not have filled
  this month in yet. Ordering is `period.startDate desc`, then `createdAt
  desc`: two periods can share a `startDate` (a MONTH period and the QUARTER
  period enclosing it both start on the same day), and nothing stops two rows
  for one account inside one period, so without the tiebreaker the winner is
  whatever order Postgres happened to return.
- **Budget rows are read from `granularity: "MONTH"` periods only.** WEEK and
  QUARTER periods also exist in the enum, and reading one of those would
  misread its figure as the monthly one, so the filter stays.
- **The income/expense × 12 is rounded to 2dp.** £833.33 × 12 is
  `9999.960000000001` in doubles but `9999.96` in the `numeric(_,2)` column.
  Unrounded, such a row reads as an update on every press and the button never
  reaches "Up to date". The balance-sheet and flow paths do no arithmetic, so
  need no rounding.
- **Every account is `ASSET` or `LIABILITY`, and both read into a plan row.**
- **Nothing observed, nothing offered.** An account with no `BalanceItem` at
  all, or a category with no monthly budget row, is skipped rather than added
  at zero.
- **A `carriedOver` row still counts.** A value cloned forward from last month
  and not yet confirmed is still the best figure available; skipping it would
  make Sync ignore the row or fall back to an older month, both more
  surprising than using it.
- **Labels come from `Account.name` and `Category.label`**, not from the
  period row's own label, so a rename propagates into the plan on the next
  Sync.
- **Both flow columns are monthly, matching the budget rows that feed them.**
  The engine multiplies by 12 itself. The flow is keyed off the *target
  account's* kind, not the budget row's own type, so a mispaired row is never
  found and misread. An account row's flow is
  always a number (`0` when nothing is budgeted, for an `OUTFLOW`, or when
  the only row found is a WEEK/QUARTER period the granularity filter
  excludes); `null` belongs to `INCOME`/`EXPENSE` rows, which have no flow
  column at all. See [`budget-transfers.md`](budget-transfers.md).

## Addition-time defaults are not updates

`drawdownPriority`, `PlanIncome.kind`, `PlanIncome.endAge` and
`PlanExpense.section` are derived from how the user has already classified the
account or category
([`src/lib/plan/realityDefaults.ts`](../../src/lib/plan/realityDefaults.ts)) —
but **only when a row is created**. `updateRow` in
[`applySyncPlan.ts`](../../src/lib/plan/applySyncPlan.ts) never writes them.

A user who tuned their drawdown order, or ended a salary at 55, must not lose it
by pressing Sync. An *addition* has no assumptions to preserve, so it gets a
starting point; an existing row already has the user's own.

| Field | Derived from | Why it matters |
|---|---|---|
| `PlanAsset.drawdownPriority` | `Account.section` (`CURRENT` 0, `MEDIUM_TERM` 1, `LONG_TERM` 2, `OTHER` 3, `PROPERTY` 9) | Left at the schema default, every synced asset ties at 0 and drawdown order becomes incidental |
| `PlanIncome.kind` | `Category.section` (`SALARY`, `PENSIONS` → `DB_PENSION`, `SIDE_INCOME` → `SELF_EMPLOYMENT`, else `OTHER`) | Hard-coding `OTHER` misclassifies a salary |
| `PlanIncome.endAge` | `retirementAge` when the kind is `SALARY`, else null | Left null a synced salary runs to `expectedDeathAge` and overstates lifetime income by decades |
| `PlanExpense.section` | `Category.section`, set only when `category.type === "EXPENSE"` (see [`reality.ts`](../../src/lib/plan/reality.ts)'s `isExpenseSection` narrowing) | Stays null for a plan-only row (no linked category) rather than reading as a guess |

The type system carries the rule: `RealityRow.defaults` is a **nested** object, so
the equality check in `resolvePlanSync` cannot compare it.

**`wrapper` is the deliberate exception**: Sync updates it. It is derived from the
account's type (`wrapperOf`), so the plan follows the classification the user set
on the account.

## The zero-value guard filters additions, not reality

`resolvePlanSync` drops additions worth £0 or less. It does **not** filter
zeros out of `latestReality`, and the difference is not cosmetic:

- A row **absent** from reality is a *removal* with reason `"gone"`. Filtering
  zeros upstream would therefore delete a paid-off mortgage's row and every
  assumption tuned on it — and silently, because the confirmation dialog names
  only plan-only rows.
- Updating an existing linked row **to** £0 is correct: a debt that reached
  zero should show as zero.
- Refusing to **create** a new row at £0 is also correct: `provisionUserSettings`
  seeds ~17 starter budget categories at £0, and without the guard a new
  user's first plan opens on a table of empty lines.
- **A budgeted flow rescues a zero-valued account row.** The test is
  `value > 0 || (flow ?? 0) > 0`: an account opened at £0 with £500/mo
  budgeted into it is not an empty row, it is exactly what budgeted flows exist for.
  Otherwise Sync would report "Up to date" while the contribution never
  reached the projection, self-healing only once the balance went positive. A
  category can never take this branch — its flow is `null` — so the starter-row
  guard above is untouched.

Putting the guard inside `resolvePlanSync` rather than in its caller keeps the
button's count, the row markers and the confirmation list honest — all three
render that one object.

## Creating a plan is a Sync against an empty plan

`createPlan` does not seed separately. It creates the `Plan` with its assumptions and
the "New car" event, then, inside the same transaction, calls
`applySyncPlan(tx, plan.id, userId, resolvePlanSync([], await latestReality(userId)), new Map())`.
An empty plan synced against reality *is* a seeded plan — one code path, not
two.

There is no separate seeding path. The wrapper comes from the account's type, the
drawdown priority and income kind from `Account.section` and `Category.section`
(`realityDefaults.ts`), and interest and fees from the account's `AccountTerms`.

`applySyncPlan` takes a transaction client rather than opening its own,
because a `"use server"` export cannot accept one and `createPlan` needs to
call it from inside its existing transaction.

## The indicator

Computed at render time by `indicatorFor`
([`syncIndicator.ts`](<../../src/app/(app)/plan/syncIndicator.ts>)) from the
same `SyncPlan` the button counts. No stored state.

| Glyph | State | Meaning |
|---|---|---|
| `✓` | `synced` | matches your balance sheet |
| `●` | `changed` | differs — Sync will replace it; the reality figure is shown beside it |
| `◇` | `plan-only` | not on your balance sheet — Sync will remove it |
| `◇` | `attached` | Sync will remove it with the row it cannot outlive |

Each glyph carries an accessible name via `role="img"`
([`SyncMarker.tsx`](<../../src/app/(app)/plan/SyncMarker.tsx>)) — the shapes
alone do not distinguish `●` from `◇` for a screen-reader user.

**`●` says that a row differs, not why** — and that is the distinction this
feature still refuses to draw. Telling "you edited this" from "reality moved"
needs a stored `syncedValue` per field, and it would change no behaviour: Sync
overwrites both identically. Showing the source figure beside the plan's own
makes the situation legible without a state machine. If the distinction is ever
wanted, the column can be added without redesigning anything.

**`plan-only` and `attached` share the `◇` glyph deliberately.** To a sighted
user both say the same thing — Sync will remove this row — and a fourth symbol
for a distinction the shape cannot carry would be noise. They differ only in
their accessible name, because the *reason* differs and one of the two names
would be false about the other's row: an `attached` row may well be on the
balance sheet — a mortgage whose own account is live, going only because its
property is not — so "not on your balance sheet" cannot be said of it.

A row removed because its account is *gone* reads as `plan-only`: in both cases
the link resolves to nothing and Sync will delete it, which is all the marker
claims. `indicatorFor` branches on `reason` only to separate `cascade` from the
other two.

## The button

`Sync with latest — N changes` in accent colour, with a breakdown beneath
reading `X updated · Y added · Z removed`, any zero part omitted. With nothing
to do it reads **`Up to date`** and is disabled — so the button also answers
"is my plan current?", which is the question that prompted this work.

A real count, on the same principle as the balance sheet's delete panel: a
number stops a mistake where "are you sure?" does not.

## The confirmation, and where it does not appear

`SyncRemovalDialog` ([source](<../../src/app/(app)/plan/SyncRemovalDialog.tsx>))
opens when Sync would remove **plan-only rows, plus anything a removal takes
with it**, and names each one. A count alone cannot tell the user whether what
is about to go is scratch work or an evening's scenario.

The rule is one function, `confirmableRemovals` in
[`sync.ts`](../../src/lib/plan/sync.ts) — `reason !== "gone"` — read twice: the
button gates on it, and the dialog filters its list with it. Two copies of a
predicate is exactly how a gate and a list drift apart.

A Sync that only updates and adds goes straight through, and so does one whose
only removals are `"gone"` with nothing hanging off them. That case is the
deliberate narrowing, and it still stands:

- A **`"gone"`** removal follows a choice the user already made on the balance
  sheet's own delete panel, which named counts and, for a permanent delete,
  required typing `DELETE`. Re-confirming a decision already made deliberately
  is the friction that teaches people to click past confirmations — the exact
  erosion the dialog exists to avoid. The row still shows a `◇` marker
  beforehand, so nothing disappears unannounced.
- A **plan-only** row exists nowhere else, has had no warning from anywhere,
  and Sync is the only thing that will ever destroy it.
- An **attached** row is going because something it cannot outlive is going.
  The balance sheet's delete panel warned about the *account*; it said nothing
  about the mortgage, the repayment or the property-sale scenario built on top
  of it in the plan. So the widening adds only cases where real work would
  otherwise vanish silently, which is the whole test.

The dialog is handed the **whole** removal list and decides what to name, both
because that keeps the rule in one place and because naming an attached row
means naming what it goes with — usually a `"gone"` row, which is itself not
named. Each line reads `Halifax mortgage — goes with The house`, and the
heading counts the two losses separately: `Sync will remove 1 plan-only row and
2 attached rows`. The zero part is omitted, so the common case still reads
exactly `Sync will remove 1 plan-only row`.

Confirming every press is how a dialog stops protecting anything.

The dialog copies the focus handling from `balance/AddAccountDrawer.tsx` —
Tab trapped in both directions, Esc cancels, body scroll locked, focus
restored to the Sync button on close.

## Authorization

Per ADR-002, application-level `userId` filtering is the primary boundary —
the server role bypasses RLS. Every read filters on `userId` directly or
through its relation (`BalanceItem` and `BudgetItem` reach one only through
`period`; plan rows only through `plan`).

Every write in `applySyncPlan` carries **its own fence** rather than trusting
the resolution step that produced the id:

- updates and removals run as `updateMany`/`deleteMany` with
  `where: { id, plan: { id: planId, userId } }`, and **throw when `count === 0`**
  — a rejected write must not report success, since the returned `SyncPlan` is
  what the UI claims happened.
- `create` cannot carry a `where`, so additions are covered by the single
  up-front `tx.plan.findFirst({ where: { id: planId, userId } })` ownership
  check, which also supplies the `retirementAge` that ends a synced salary.

The two mechanisms are complementary: the ownership check is the only fence
possible on a create; the per-statement fences catch a foreign row id passed
under a legitimately owned plan id.

### One row per account, per plan

`PlanAsset` and `PlanLiability` carry `@@unique([planId, accountId])`;
`PlanIncome` and `PlanExpense` carry `@@unique([planId, categoryId])`. The
design spec said uniqueness was "enforced in code by the resolution step" — it
is not, and could not be: `resolvePlanSync` runs *outside* the transaction that
applies it, so two concurrent presses (two tabs, a double submit) both resolve
"add this account" against the same plan and both create. The row would then
appear twice, both marked synced, and net worth would double-count for good.
Only the database can refuse the second write.

Postgres treats NULLs as distinct by default, so plan-only rows — the ones with
no link — are unaffected however many a plan holds; the plan's own Add buttons
keep working. Deleting a plan row clears its link as it sets `deletedAt`, so a
tombstone never occupies the slot the next Sync needs.

## Out of scope, named so nobody builds them by accident

- **Budgeted withdrawals.** A `TRANSFER` `OUTFLOW` does not reach the projection:
  the plan derives withdrawals from deficits, and budgeting them needs engine
  work. See [`budget-transfers.md`](budget-transfers.md).
- **Distinguishing "you changed this" from "reality moved"** — see the
  indicator section: needs a stored `syncedValue` per field and changes no
  behaviour.
- **Retiring `PlanLiability.linkedAssetId`.** `Account.linkedAccountId` now
  carries the mortgage ↔ property pairing, so the plan's own copy is
  duplication. Noted, not addressed.
- **Per-row sync** — all-or-nothing is a deliberate choice.
- **Undo** — Sync overwrites; the confirmation covers the destructive case.

## Adding a field to a plan row touches more hand-maintained lists than it looks

A field on `PlanAsset` or `PlanLiability` passes through six mappers that must all
carry it:

1. the Prisma column,
2. `SerializedPlanAsset`/`SerializedPlanLiability` in
   [`serialized.ts`](<../../src/app/(app)/plan/serialized.ts>),
3. the Prisma → serialized mapping in
   [`page.tsx`](<../../src/app/(app)/plan/page.tsx>),
4. [`toPlanInput.ts`](../../src/lib/plan/toPlanInput.ts) (Prisma rows → `PlanInput`),
5. [`serializedInput.ts`](../../src/lib/plan/serializedInput.ts) (serialized rows →
   `PlanInput`, the in-browser live projection),
6. the engine's `AssetInput`/`LiabilityInput` in
   [`types.ts`](../../src/lib/plan/types.ts).

**That is the floor, not the count.** Check every call site that reads specific
fields. `revisionRate`/`revisionAge` also needed
[`usePlanProjection.ts`](<../../src/app/(app)/plan/usePlanProjection.ts>) (dragging
a liability's bar re-saves every field) and
[`PropertyFields.tsx`](<../../src/app/(app)/plan/PropertyFields.tsx>) (the mortgage
editor in the property card). `annualIncome`/`incomeFromAge` needed neither,
because dragging an asset's bar never touches them.

A field added to some places and not others fails **silently**: one chart right,
the other stale. `tsc` will not catch it, because Prisma's `create`/`update`
argument types are wide enough to accept a missing or stray field.

**Some boundaries are pinned.** `page.tsx`'s `const serialized: SerializedPlan`,
the `serialized.ts` types and the call sites typed through
`UpdatePlanLiabilityInput` are enforced by annotation. `toPlanInput.ts` and
`serializedInput.ts` annotate each object literal with
`Complete<AssetInput>`/`Complete<LiabilityInput>` (`{ [K in keyof Required<T>]: T[K] }`),
which requires every key to be present while allowing `undefined`, so a forgotten
field is a compile error. `balance/page.tsx`'s `AccountTerms` object carries the
same pin. Do not use `[K in keyof T]-?`: it strips `undefined` from the value types
too. Everything Prisma writes, and every call site reading individual fields, is
unpinned, so check the actual field, not the list.

## Known gaps

- **The plan's own Add buttons create plan-only rows.** `createPlanAsset`,
  `createMortgageForProperty`, `createPlanLiability`, `createPlanIncome` and
  `createPlanExpense` set no `accountId`/`categoryId`, so everything added from the
  plan is `◇` and the next Sync offers to delete it, including a property and
  mortgage built through the plan drawer and any `PROPERTY_SALE` event on that
  property. The confirmation names all of it. The plan-side mortgage drawer
  duplicates the balance sheet's and yields worse data; retiring it is Not yet
  built.
- **`deletePlanAsset` does not take the property's sale events with it.** It
  cascades to the linked mortgage and that mortgage's repayment expense, but a
  `PROPERTY_SALE` event survives its property, pointing at a soft-deleted asset
  that `toPlanInput` no longer loads: the zombie Sync avoids, from the other door.
  Sync's cascade does not reach it, because `loadPrimaryPlanRows` filters
  `deletedAt: null`. The fix belongs in `deletePlanAsset`'s own transaction.
- **A repayment expense is removed without its liability.** Every repayment
  expense is plan-only (`linkRepaymentExpense` sets no `categoryId`), so any
  Sync removes it while the mortgage survives — where `deletePlanExpense`
  refuses exactly that, and `unlinkRepaymentExpense` copies the amount back to
  `monthlyRepayment` first. The projection falls back to the liability's stored
  `monthlyRepayment`, which may be stale, so the mortgage keeps paying at a
  different rate. The confirmation names the row, so it is not silent. The real fix is for the plan
  drawer to link its rows (the gap above), not an exception to "Sync removes
  plan-only rows".
- **A plan row deleted from the plan comes back.** The plan's own row delete is
  a soft delete, and `loadPrimaryPlanRows` filters `deletedAt: null`, so a
  soft-deleted row for a still-live account is invisible to the resolver and
  the next Sync adds a fresh one — a new row, not the old one revived, since
  the tombstone's link is cleared on delete. Removing the account (or archiving
  it) is the way to remove its plan row for good. Sync's own removals are hard
  deletes.
- **Two primary-plan queries per `/plan` render** — `getPrimaryPlan` and
  `getPlanSyncPreview` each load it. Inherent to the server-action boundary,
  not a correctness problem.
- **A cascaded `PlanEvent` carries no marker.** `PlanView` passes the sync
  preview to the four row tables; `EventsTable` never renders a `SyncMarker`,
  so a `PROPERTY_SALE` event Sync is about to delete shows nothing beforehand.
  Not silent in practice — an event is only ever `reason: "cascade"`, which
  always gates the confirmation, so it is always named before it goes — but it
  is the one removable thing the indicator does not cover.
- **A budget `EXPENSE` category and a `REPAYMENT` row can double-count one
  payment.** A `REPAYMENT` budget row anchors to a `LIABILITY` account and feeds
  `PlanLiability.monthlyRepayment`; a repayment is a separate kind from a
  `TRANSFER` because its interest is consumed (see
  [`budget-transfers.md`](budget-transfers.md)). Nothing detects an `EXPENSE` row on
  a "Mortgage" *category* coexisting with a `REPAYMENT` row on the mortgage
  *account*. `latestCategoryRows` mints a `PlanExpense` of £15,000/yr from the
  first and `monthlyRepayment` £1,250 adds £15,000/yr from the second: £30,000/yr of
  outflow for one payment. Keeping both is the natural migration path, since an
  expense category was the only way to record a mortgage before `REPAYMENT`
  existed. Closing it needs a category to declare itself a repayment at an account
  and be excluded from category totals. Until then the migration note in
  `budget-transfers.md` is the only mitigation.

## Code map

| Concern | File |
|---|---|
| `PlanAsset.accountId`, `PlanLiability.accountId`, `PlanIncome.categoryId`, `PlanExpense.categoryId` (all `onDelete: SetNull`) | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| Pure resolver — what a Sync would do, no database; the dependency closure and the confirmation rule | [`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts) |
| Addition-time classification defaults (no database) | [`src/lib/plan/realityDefaults.ts`](../../src/lib/plan/realityDefaults.ts) |
| Latest observation per account and category | [`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts) |
| Writing a `SyncPlan`, fenced, inside a caller's transaction | [`src/lib/plan/applySyncPlan.ts`](../../src/lib/plan/applySyncPlan.ts) |
| `getPlanSyncPreview` / `syncPlan` server actions | [`src/app/(app)/plan/syncActions.ts`](<../../src/app/(app)/plan/syncActions.ts>) |
| `createPlan` as a sync against an empty plan | [`src/app/(app)/plan/actions.ts`](<../../src/app/(app)/plan/actions.ts>) |
| Button, counts, breakdown, confirmation gate | [`src/app/(app)/plan/SyncButton.tsx`](<../../src/app/(app)/plan/SyncButton.tsx>) |
| Row state from a `SyncPlan` | [`src/app/(app)/plan/syncIndicator.ts`](<../../src/app/(app)/plan/syncIndicator.ts>) |
| Marker glyphs, accessible names, which figure a changed row shows | [`src/app/(app)/plan/SyncMarker.tsx`](<../../src/app/(app)/plan/SyncMarker.tsx>) |
| Removal confirmation | [`src/app/(app)/plan/SyncRemovalDialog.tsx`](<../../src/app/(app)/plan/SyncRemovalDialog.tsx>) |
| `RowTerms`, the exhaustiveness-pinned `TERM_COMPARE_KEYS`/`rowTermsEqual`, `ageOnDate` | [`src/lib/plan/rowTerms.ts`](../../src/lib/plan/rowTerms.ts) |
| A mortgage's rate in force at a given age (`revisionAge`/`revisionRate`, falling back to the fixed rate) | [`src/lib/plan/liabilities.ts`](../../src/lib/plan/liabilities.ts) |
| A final-salary asset's balance zeroed once entitled; its `DB_PENSION` income stream | [`src/lib/plan/project.ts`](../../src/lib/plan/project.ts), [`src/lib/plan/streams.ts`](../../src/lib/plan/streams.ts) |

### Testing

Unit tests live under `tests/unit/`, integration tests under `tests/integration/`.

- **Unit**
  - `tests/unit/lib/plan/sync.test.ts`: every resolver case, including kind
    collision, the zero-value guard and the cascade (transitive depth, the
    plan-only/dragged overlap counted once, a dragged row leaving `updates`).
  - `tests/unit/lib/plan/realityDefaults.test.ts`.
  - `tests/unit/lib/plan/rowTerms.test.ts`: the exhaustiveness pin.
  - `tests/unit/app/(app)/plan/syncIndicator.test.ts`.
  - `tests/unit/app/(app)/plan/SyncButton.test.tsx`: counts, breakdown, and the
    three confirmation branches (plan-only; a `"gone"` row that drags something; a
    `"gone"` row that does not).
  - `tests/unit/app/(app)/plan/SyncMarker.test.tsx`: four distinct accessible
    names, and which figure a changed row shows.
  - `tests/unit/app/(app)/plan/SyncRemovalDialog.test.tsx`: names attached rows
    and what they go with, not the `"gone"` rows.
- **Integration** (real Postgres)
  - `tests/integration/schema.planLinks.integration.test.ts`: the four links, and
    `SetNull` proved by the row surviving.
  - `tests/integration/lib/plan/reality.integration.test.ts`.
  - `tests/integration/lib/plan/applySyncPlan.integration.test.ts`: a foreign row id
    under an owned plan id is rejected by the per-statement fence.
  - `tests/integration/app/(app)/plan/syncActions.integration.test.ts`: assumptions
    survive, plan-only removed, archived account removed, second sync is a no-op,
    cross-tenant.
  - `tests/integration/app/(app)/plan/syncActions.cascade.integration.test.ts`: an
    archived property takes its mortgage, repayment and sale event.
  - `tests/integration/app/(app)/plan/syncActions.terms.integration.test.ts`: one
    mutation test per `RowTerms` field through `setAccountTerms` → Sync, a second
    Sync reporting zero updates, and the kind-gating cases.
  - `tests/integration/app/(app)/plan/actions.createPlan.integration.test.ts`.
- **E2E**
  - `tests/e2e/plan-sync.spec.ts`: change a balance value, see the `●` marker and
    source figure, press Sync, see the button read `Up to date`.
  - `tests/e2e/budget-transfers.spec.ts`: budget a repayment at a mortgage, press
    Sync, find it on the liability's `monthlyRepayment`.

  Both are server-action journeys, so both are chromium-gated.

# Budget Table

**What:** Per-month spreadsheet of planned vs actual income, spending, transfers and debt repayments across four row kinds.  
**Route:** `/budget`  
**Key points:**
- Four row kinds: `INCOME`, `EXPENSE`, `TRANSFER`, `REPAYMENT`. Each keys on a `Category` or an `Account`.
- Columns are Budget, Actual and Notes. A "Left over" footer shows the surplus for both Budget and Actual.
- Transactions mode off: Actual is a number you type. Transactions mode on: Actual is read-only and computed from transactions.
- `REPAYMENT` rows render inside Expenses and count in that total. `TRANSFER` rows get their own section and do not count as spending.

## Four row kinds

| Kind | Keyed on | Renders in | Actual source (transactions mode) |
|------|---------|---------|--------------|
| `INCOME` | `Category` + income section | Income | Transactions categorised as that category |
| `EXPENSE` | `Category` + expense section | Expenses | Transactions categorised as that category |
| `REPAYMENT` | `Account` (liability) | Expenses, under "Debt payments" | Transfer flow of that account |
| `TRANSFER` | `Account` (asset) + direction | "Transfers and saving" | Transfer flow of that account |

`sectionOf()` in `src/lib/budget/sections.ts` decides where a row renders. The reasoning, the surplus formula and the limits of the anchored kinds are in [`budget-transfers.md`](budget-transfers.md).

## Sections within each kind

- `EXPENSE` rows carry a `CategorySection`: `FIXED`, `VARIABLE` or `DISCRETIONARY`.
- `INCOME` rows carry one of `SALARY`, `SIDE_INCOME`, `INVESTMENTS`, `PENSIONS` or `OTHER`.
- `TRANSFER` and `REPAYMENT` rows carry no section. They anchor to an account.

## Actuals

With the transactions feature off, `BudgetItem.actual` is stored and editable. With it on (Settings toggle), the page overlays a computed figure for display and the stored column is left alone. Category-keyed rows net their category's transactions in the month; account-keyed rows net their account's transfer flow. When transactions mode is on, any category with a categorised transaction in the month gets a £0 budget row materialised on page load, so categorised spend always appears.

## Period management

- Viewing a month never creates its `FinancialPeriod`; the page shows an empty sheet. The period is created on the first write (adding a row or filling from another month) through `ensurePeriodForMonthIn` (`src/lib/budget/ensurePeriod.ts`).
- New users get a seeded £0 sheet for the current month (`src/lib/onboarding/defaults.ts`, see [`onboarding.md`](onboarding.md)).
- **Fill from another month** (`copyPeriodFrom` in `src/app/(app)/budget/actions.ts`) replaces every row in the target month with a copy of the source month's rows. Budgeted amounts carry over and actuals reset to 0. The replaced rows are hard-deleted. Rows whose anchor account has since been archived, deleted or re-kinded are skipped, and the sheet reports the count.
- There are no budget templates. The only copy path is month to month.
- A period holds at most 500 live rows (`MAX_ITEMS_PER_PERIOD`, `src/lib/budget/limits.ts`).

## One anchored row per account per period

Two `TRANSFER`/`REPAYMENT` rows on one account would each render the account's whole net and double-count it. The Add drawer filters already-anchored accounts (`eligibleAnchorAccounts`), and `createItemForMonth` enforces the rule server-side.

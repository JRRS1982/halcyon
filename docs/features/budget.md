# Budget Table

**What:** Per-period spreadsheet of planned vs actual income, spending, transfers, and debt repayments across four row kinds.  
**Route:** `/budget`  
**Key points:**
- Four row kinds: `INCOME`, `EXPENSE`, `TRANSFER`, `REPAYMENT` — each keys on a different anchor (Category or Account)
- Difference column = budgeted − actual (expenses) or actual − budgeted (income); positive means on track
- Actuals pulled from categorised transactions (INCOME/EXPENSE) or transfer data (TRANSFER/REPAYMENT)
- REPAYMENT rows render inside Expenses and count toward that total — a mortgage payment is spending

## Four row kinds

| Kind | Keyed on | Section | Actual source |
|------|---------|---------|--------------|
| `INCOME` | `Category` + income section | Income | Transactions categorised as that category |
| `EXPENSE` | `Category` + expense section | Expenses | Transactions categorised as that category |
| `REPAYMENT` | `Account` (LIABILITY) | Expenses | Actuals from transfer data |
| `TRANSFER` | `Account` (ASSET) + direction | Transfers | Actuals from transfer data |

REPAYMENT and EXPENSE both render under the Expenses section header and both count toward the Expenses total (`sectionOf()` in `src/lib/budget/sections.ts`). From the user's perspective, a mortgage repayment is spending.

TRANSFER rows get their own Transfers section and do **not** count as spending (a pension contribution is money you still own).

## Sections within each kind

- **EXPENSE rows** carry a `CategorySection`: `FIXED`, `VARIABLE`, `DISCRETIONARY`
- **INCOME rows** carry a `CategorySection`: `SALARY`, `SIDE_INCOME`, `INVESTMENTS`, `PENSIONS`, `OTHER`
- **TRANSFER / REPAYMENT** rows carry no section — they anchor to an account

## Columns

- **Budgeted**: the planned figure, user-editable
- **Spent** (or Received for income): the actual figure, computed from categorised transactions or transfer data
- **Difference**: budgeted − actual (for expenses); actual − budgeted (for income) — positive means on track

## Period management

`ensurePeriod` (`src/lib/budget/ensurePeriod.ts`) creates a `FinancialPeriod` for the current month if one doesn't exist. New accounts get a seeded £0 budget sheet at sign-up via `src/lib/onboarding/defaults.ts`.

**Copy from previous**: copies all rows from a past period into the current one (`copyPeriod` in `src/lib/budget/copyPeriod.ts`). Rows whose anchor account has since been archived, deleted, or re-kinded are skipped; the sheet reports the count.

## Constraint: one row per account per period

TRANSFER and REPAYMENT rows are one-per-account-per-period — two rows on the same account would each render the full actual and double-count the total. The add-drawer (`eligibleAnchorAccounts`) filters already-anchored accounts; the server action (`createItemForMonth`) enforces it independently.

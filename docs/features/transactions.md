# Ledger and Transactions

**What:** A paginated transaction ledger with CSV import, batch reversal, single and bulk categorisation, approval of the categories an import suggests, and a "write a line" box for typing one transaction. Hidden when `transactionsEnabled = false`.  
**Route:** `/transactions`  
**Key points:**
- CSV import is two steps: `previewImport` flags likely duplicates, then `commitImport` writes an `ImportBatch` and its `Transaction` rows in one `$transaction`.
- Dedupe key: `accountId | date | amountCents | normalizedDescription`. A match is flagged for the user to keep or drop, never merged silently.
- Import pre-categorises rows from the user's own history (`src/lib/transactions/memory.ts`). Those categories are suggestions, shown in pencil until the user approves them (`Transaction.isCategoryConfirmed`).
- Filters, search and the controls card: see [ledger-filters.md](ledger-filters.md).

All actions in `src/app/(app)/transactions/actions.ts` call `requireTransactionsEnabled`, so the route and its server actions both refuse a user who has the feature off.

## Ledger

Columns: select, date, description, account, amount, category, note. Dates read the UK way (`28 Oct`, with the year only when it isn't this year; `shortDate` in `src/lib/date/humanDate.ts`), and amounts go through `formatAmount`, so they follow the user's currency and number format. The page size is `PAGE_SIZE` (50). The footer nets the rows on screen and is labelled `Total ·` when every matching row fits the page, `This page ·` otherwise.

The page headline says what the ledger needs from you: `N transactions to approve` counts rows with no category plus rows still in pencil, and the standfirst splits the two.

Amount filters match **magnitude**, not sign: filtering for £50 matches a £50 debit and a £50 credit.

## CSV import

Pipeline: parse the file in the browser, `previewImport`, user confirms or drops duplicates, `commitImport`.

- **Column and date guess** (`guessMapping` in `src/lib/transactions/import.ts`): the header names pick the date, description and amount columns, and `guessDateFormat` (`src/lib/transactions/date.ts`) reads the date order off that column's cells: the first of day-month-year, year-month-day or month-day-year that parses every row, falling back to day first. The user sees and can change both before anything is written.

- **Dedupe** (`src/lib/transactions/dedupe.ts`): the preview compares the CSV against live transactions in the chosen account on the dates the CSV names. A brand-new account has nothing to match.
- **Limits** (`src/lib/transactions/limits.ts`): `MAX_IMPORT_ROWS` (5,000) rows and `MAX_IMPORT_FILE_BYTES` (2 MB) per import; each CSV cell is at most 300 characters.
- **Per-user cap:** `MAX_TRANSACTIONS_PER_USER` (250,000), counted over every row including soft-deleted ones, so reversing an import frees no room. `createTransaction` (quick-add) enforces the same cap.
- **Atomic:** the batch and its rows are created in one transaction. A failed write leaves no batch behind.
- **Auto-categorisation:** `commitImport` rebuilds a description-to-category memory (`loadCategoryMemory`) from the user's most recent `MEMORY_WINDOW` (2,000) categorised transactions and applies it to the new rows. Only live categories count. Nothing is stored. A row given a category this way is written with `isCategoryConfirmed = false`; a row with no match stays uncategorised.

## Batch reversal

`reverseImport` soft-deletes the batch's live transactions and stamps `ImportBatch.reversedAt`. Reversed batches leave the picker, as do batches with no live rows left. Transactions already deleted individually are unaffected. Rows get `deletedAt`; nothing is removed from the database.

## Categorisation

- **Single:** a row's category cell opens an inline picker (`CategoryCombobox.tsx`) that can also create a category or mark the row as a transfer to another account.
- **Bulk:** select rows, and the controls card's search box becomes a category picker. One server action updates every selected row. Selected rows can also be bulk-deleted (soft) or marked as transfers.

Choosing a category or a transfer, singly or in bulk, also approves the row.

## Approval

A pencilled row (a category with `isCategoryConfirmed = false`) still counts in the budget; approval only records that the user agrees with it. `setCategoryApproval` flips the flag:

- **One row:** the row's `Approve` button approves it, and pressing `✓ Approved` takes the approval back.
- **Every row:** `Approve all N suggested` sends no ids and approves every pencilled row the user has.

Withdrawing approval always needs the rows it applies to. Only rows that carry a category have an approval to give or take. The filter drawer's `To approve only` (`?check=1`) narrows the ledger to rows still needing you; see [ledger-filters.md](ledger-filters.md).

## Adding one transaction

For cash spending that no statement captures, or anything that shouldn't wait for the next export.

- **Write a line:** type it as you would jot it (`4.35 Pret coffee`, `+2,850 Salary`, `12/10 30 Fuel`). `parseLine` (`src/lib/transactions/writeLine.ts`) reads the amount, direction, date and description, and `suggestCategory` offers the category that description was last filed under, from the same `loadCategoryMemory` the import uses. A line it can't read asks for an amount instead of opening the form.
- **The add dialog:** `QuickAdd.tsx`, on the shared `Drawer`, opens filled in from the line (or empty from `Add transaction` with nothing typed) for the user to check. Saving calls `createTransaction`, which adds one `Transaction` with no `ImportBatch`. A category chosen here is the user's own choice, so the row is approved.

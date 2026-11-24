# Ledger and Transactions

**What:** A paginated transaction ledger with CSV import, batch reversal, single and bulk categorisation, approval of the categories an import suggests, and a "write a line" box for typing one transaction. Hidden when `transactionsEnabled = false`.  
**Route:** `/transactions`  
**Key points:**
- CSV import is two steps: `previewImport` flags likely duplicates, then `commitImport` writes an `ImportBatch` and its `Transaction` rows in one `$transaction`.
- Dedupe key: `accountId | date | amountCents | normalizedDescription`. A match is flagged for the user to keep or drop, never merged silently.
- Import pre-categorises rows from the user's own history (`src/lib/transactions/memory.ts`). Those categories are suggestions, shown in pencil until the user approves them (`Transaction.isCategoryConfirmed`).
- The page has two ruled sections under the headline: **Add transactions** (`Import statement…`, `Undo import…` and the CSV limits, then `Add transaction` at the end of the row) and **Review transactions** (the controls card, then the ledger). Approving belongs to reviewing, so `Approve all N suggested` sits in the controls card, not with the import buttons.
- Filters, search and the controls card: see [ledger-filters.md](ledger-filters.md).
- **Possible transfers** (a drawer filter) pairs rows that cancel out across accounts, so an untagged transfer can be marked as one, both sides at once, or dismissed as not one: see [ledger-filters.md](ledger-filters.md#possible-transfers).

All actions in `src/app/(app)/transactions/actions.ts` call `requireTransactionsEnabled`, so the route and its server actions both refuse a user who has the feature off.

## Ledger

Columns: select, date, description, account, amount, category, note. Dates read the UK way (`28 Oct`, with the year only when it isn't this year; `shortDate` in `src/lib/date/humanDate.ts`), and amounts go through `formatAmount`, so they follow the user's currency and number format. The page size is `PAGE_SIZE` (50). The footer nets the rows on screen and is labelled `Total ·` when every matching row fits the page, `This page ·` otherwise.

The page headline says what the ledger needs from you: `N transactions to approve` counts rows with no category plus rows still in pencil, and the standfirst splits the two.

Amount filters match **magnitude**, not sign: filtering for £50 matches a £50 debit and a £50 credit.

## CSV import

Pipeline: parse the file in the browser, `previewImport`, user reviews left-out rows and duplicates, `commitImport`.

- **Folded settings:** the card leads with the destination account, then three one-line settings (Columns, Details, Skipping), each a summary of the current choice with a Change link that opens its controls in place. Columns opens by itself when the guess leaves rows unreadable. The preview below formats dates and amounts the way the ledger does.
- **Preview details:** each preview row has a Details toggle, the first open by default, showing the kept columns with the same `ExtraColumns` component the ledger's Details panel uses, so the preview shows exactly what the ledger will. In both, the open panel is a `DetailCard`: it starts under Description, with a notch pointing up at the toggle, so it reads as part of the row above rather than a row of its own.
- **Column and date guess** (`guessMapping` in `src/lib/transactions/import.ts`): the header names pick the date, description and amount columns, and `guessDateFormat` (`src/lib/transactions/date.ts`) reads the date order off that column's cells: the first of day-month-year, year-month-day or month-day-year that parses every row, falling back to day first. The user sees and can change both before anything is written.
- **Description fallback** (`fallbackDescriptionColumn`): read when the description cell is empty. A column headed exactly `Name` is guessed, because some banks leave Description blank on pot transfers and put the payee there. The card says how many rows it filled, so the choice is confirmed against the preview.
- **Leaving rows out** (`guessLeaveOut`, `columnValues`, `isLeftOut`): the user picks a column and ticks values; matching rows are not imported. A `Type` column holding `Pot transfer` is pre-ticked, since moving money to or from a pot is neither income nor spending. Nothing is dropped silently: the review step lists every skipped row, ticked, and unticking one imports it. `pairOpposites` groups rows of equal size and opposite sign within `PAIR_WINDOW_DAYS` as one "cancels out" unit, so a move into a pot sits beside its move back. The grouping is display only and never changes what is imported; rows with no opposite are listed alone with their net, since those did move money. Left-out rows travel to `commitImport` as `skipIndexes`, the same path confirmed duplicates use, so the server needs no rule of its own.

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
- **Every row:** `Approve all N suggested`, beside the ledger's search box, sends no ids and approves every pencilled row the user has.

Withdrawing approval always needs the rows it applies to. Only rows that carry a category have an approval to give or take. The filter drawer's `To approve only` (`?check=1`) narrows the ledger to rows still needing you; see [ledger-filters.md](ledger-filters.md).

## Adding one transaction

For cash spending that no statement captures, or anything that shouldn't wait for the next export.

- **Quick entry:** the first field of the add dialog takes a transaction typed as you would jot it (`4.35 Pret coffee`, `+2,850 Salary`, `12/10 30 Fuel`). `parseLine` (`src/lib/transactions/writeLine.ts`) reads the amount, direction, date and description into the fields below as it is typed, and `suggestCategory` (debounced) offers the category that description was last filed under, from the same `loadCategoryMemory` the import uses. A line it can't read leaves the fields alone and, once the user moves on, asks for an amount. It used to be a bare box on the page, which read as a puzzle; inside the dialog it explains itself.
- **The add dialog:** `QuickAdd.tsx`, on the shared `Drawer`, opens empty from `Add transaction`. Saving calls `createTransaction`, which adds one `Transaction` with no `ImportBatch`. A category chosen here is the user's own choice, so the row is approved.

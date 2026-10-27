# Ledger and Transactions

**What:** A paginated transaction ledger with CSV import, batch reversal, and single and bulk categorisation. Hidden when `transactionsEnabled = false`.  
**Route:** `/transactions`  
**Key points:**
- CSV import is two steps: `previewImport` flags likely duplicates, then `commitImport` writes an `ImportBatch` and its `Transaction` rows in one `$transaction`.
- Dedupe key: `accountId | date | amountCents | normalizedDescription`. A match is flagged for the user to keep or drop, never merged silently.
- Import pre-categorises rows from the user's own history (`src/lib/transactions/memory.ts`).
- Filters, search and the controls card: see [ledger-filters.md](ledger-filters.md).

All actions in `src/app/(app)/transactions/actions.ts` call `requireTransactionsEnabled`, so the route and its server actions both refuse a user who has the feature off.

## Ledger

Columns: select, date, description, account, amount, category, note. The page size is `PAGE_SIZE` (50). The footer nets the rows on screen and is labelled `Total ·` when every matching row fits the page, `This page ·` otherwise.

Amount filters match **magnitude**, not sign: filtering for £50 matches a £50 debit and a £50 credit.

## CSV import

Pipeline: parse the file in the browser, `previewImport`, user confirms or drops duplicates, `commitImport`.

- **Dedupe** (`src/lib/transactions/dedupe.ts`): the preview compares the CSV against live transactions in the chosen account on the dates the CSV names. A brand-new account has nothing to match.
- **Limits** (`src/lib/transactions/limits.ts`): `MAX_IMPORT_ROWS` (5,000) rows and `MAX_IMPORT_FILE_BYTES` (2 MB) per import; each CSV cell is at most 300 characters.
- **Per-user cap:** `MAX_TRANSACTIONS_PER_USER` (250,000), counted over every row including soft-deleted ones, so reversing an import frees no room. `createTransaction` (quick-add) enforces the same cap.
- **Atomic:** the batch and its rows are created in one transaction. A failed write leaves no batch behind.
- **Auto-categorisation:** `commitImport` rebuilds a description-to-category memory from the user's most recent `MEMORY_WINDOW` (2,000) categorised transactions and applies it to the new rows. Only live categories count. Nothing is stored.

## Batch reversal

`reverseImport` soft-deletes the batch's live transactions and stamps `ImportBatch.reversedAt`. Reversed batches leave the picker, as do batches with no live rows left. Transactions already deleted individually are unaffected. Rows get `deletedAt`; nothing is removed from the database.

## Categorisation

- **Single:** a row's category cell opens an inline picker (`CategoryCombobox.tsx`) that can also create a category or mark the row as a transfer to another account.
- **Bulk:** select rows, and the controls card's search box becomes a category picker. One server action updates every selected row. Selected rows can also be bulk-deleted (soft) or marked as transfers.

## Quick-add

`QuickAdd.tsx` calls `createTransaction` to add one `Transaction` with no `ImportBatch`. Use it for cash spending that no statement captures.

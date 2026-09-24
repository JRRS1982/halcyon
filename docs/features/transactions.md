# Ledger and Transactions

The ledger shows all transactions for the user, paginated. Feature-gated: hidden entirely when `UserSettings.transactionsEnabled = false`.

See [ledger-filters.md](ledger-filters.md) for filter/search details.

## Ledger

Columns: date, description, amount, account, category. Rows are paginated; the footer shows a net total for the current page (labelled `This page ·`) or all matching rows when no pagination is active (`Total ·`).

Amount matching uses **magnitude** (absolute value), not sign — filtering for £50 matches both a £50 debit and a £50 credit.

Selecting rows switches the controls card from search mode to categorise mode — the search box becomes a category picker for bulk assignment.

## CSV import

Pipeline: file upload → parse CSV → deduplicate against existing transactions → preview → confirm → `ImportBatch` + `Transaction` rows written in one transaction.

**Deduplication key** (`src/lib/transactions/dedupe.ts`): `accountId | YYYY-MM-DD | amountCents | normalizedDescription`. Two rows with the same fingerprint are flagged as likely duplicates for the user to confirm or drop — never silently merged.

Limits: `MAX_IMPORT_ROWS` controls the row cap per import (`src/lib/transactions/limits.ts`). Each CSV cell is validated to max 300 characters.

The batch is written atomically: if any row fails, nothing is committed.

## Batch reversal

`reverseImport` (`src/app/(app)/transactions/actions.ts`): soft-deletes all live (non-individually-deleted) transactions in a batch and stamps `ImportBatch.reversedAt`. Reversed batches disappear from the reverse-import picker. Individually deleted transactions within the batch are unaffected.

This is a soft delete — transactions are marked with `deletedAt`, not removed from the database.

## Categorisation

- **Individual**: clicking a transaction's category cell opens an inline picker
- **Bulk**: select one or more rows → controls card switches to categorise mode → pick a category → all selected rows are updated in one server action

`memory.ts` (`src/lib/transactions/memory.ts`) tracks per-description category suggestions to pre-populate the picker.

## Quick-add

Manual transaction entry via `QuickAdd.tsx` — creates a single `Transaction` row without an `ImportBatch`. Useful for cash transactions not captured by a bank statement.

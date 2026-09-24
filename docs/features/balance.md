# Balance Sheet

Per-period grid showing all user accounts grouped by section. One row per account per period; the stored fact is `BalanceItem.value`.

## Sheet structure

Rows group by `Account.section` (user-editable). Within a section, accounts sort by their position in the grid. Columns: account name, value (editable in-place), notes (editable in-place).

Net worth = sum of all asset values − sum of all liability values. Computed client-side from the displayed rows.

## Account type drives everything

`Account.type` is the durable fact (e.g. `CURRENT_ACCOUNT`, `SAVINGS`, `STOCKS_ISA`, `SIPP`, `MORTGAGE`). Two derived properties are computed on demand, never stored as columns:

- **`kindOf(type)`** → `ASSET` or `LIABILITY` (`src/lib/accounts/accountDraft.ts`)
- **`wrapperOf(type)`** → `ISA`, `PENSION`, `GIA`, `CASH`, `PROPERTY`, `DB_PENSION`, or `null`

The balance sheet uses `kindOf` to separate assets from liabilities in the net-worth calculation and in the dashboard series.

## Adding accounts

Add drawer (`AddAccountDrawer.tsx`): requires name and type. `ACCOUNT_TYPES` in `src/lib/accounts/accountDraft.ts` declares every valid type, its `kind`, its `wrapper`, and which `AccountTerms` fields it prompts for.

One `BalanceItem` is created for the new account in the current period at £0 on save.

## Editing

- **Value / notes**: editable in-place in the sheet cells (`actions.ts` → `updateBalanceItem`)
- **Name / type / section / terms**: editing opens the account card (`AccountCard.tsx`), which owns all four fields in one form

Changing `type` changes `kindOf`/`wrapperOf` at runtime everywhere — the derived values update automatically.

## AccountTerms

A 1:1 satellite on `Account` (`AccountTerms` model). Nine nullable projection parameters fed to Plan Sync:

| Field | Purpose | Used by |
|-------|---------|---------|
| `expectedReturnPct` | Annual growth rate | Assets |
| `feePct` | Annual platform/fund fee | ISA, SIPP, GIA, property |
| `minAccessAge` | Earliest withdrawal age | SIPP |
| `annualIncome` | Final-salary pension entitlement (£/yr) | DB_PENSION |
| `interestPct` | Annual interest rate | Liabilities |
| `interestOnly` | Interest-only mortgage flag | Mortgages |
| `revisionDate` | Fixed-rate end date | Mortgages |
| `revisionRate` | Post-revision rate | Mortgages |
| `endDate` | When the account closes (mortgage paid off, pension converts) | Mortgages, DB_PENSION |

Which fields appear in the card for a given type is declared in `ACCOUNT_TYPES[n].terms` — not fenced in the database.

## Archiving and deleting

- **Archive** (`accountActions.ts` → `archiveAccount`): sets `Account.archived = true`. Archived accounts no longer appear in the balance sheet or add drawers but keep their historical `BalanceItem` rows and remain valid counterparties for existing budget rows.
- **Delete** (`DeleteAccountPanel.tsx` → `deleteAccount`): hard-deletes the account and cascades to its `BalanceItem` rows. Only offered when the account has no live transactions (the FK is `onDelete: Restrict` via the transaction's `transferAccount` reference).

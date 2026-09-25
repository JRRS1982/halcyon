# Settings

**What:** User-configurable preferences, feature toggles, category and account management, and irreversible data actions.  
**Route:** `/settings`  
**Key points:**
- Preferences: currency, number format, theme — saved to `UserSettings`
- Feature toggles: Transactions, Budget transfers, Plan — each hides its nav item and page entirely
- Category management: create, rename, soft-delete, merge (merge reassigns transactions before deleting source)
- DataPrivacy actions (export, clear, reset, delete account) all require password re-entry since PR #208

## Preferences

Saved to `UserSettings`:

| Setting | Options | Default |
|---------|---------|---------|
| Currency | ISO codes via `CURRENCY_CODES` | GBP |
| Number format | `COMMA_0` etc. via `NUMBER_FORMATS` | COMMA_0 |
| Theme | `SYSTEM`, `LIGHT`, `DARK` | SYSTEM |

Saved on change (theme) or on form submit (currency + number format) via `src/app/(app)/settings/actions.ts`.

## Dashboard charts

Toggle which charts appear on `/dashboard`. Keys stored in `UserSettings.hiddenCharts` (String[]). See [dashboard.md](dashboard.md) for chart details.

## Category management

`CategoryManager.tsx` → `categoryActions.ts`:

- **Create**: adds a new `Category` (type + section + label)
- **Rename**: updates the label
- **Delete** (soft): sets `Category.deletedAt`. Soft-deleted categories no longer appear in pickers but existing transactions keep their `categoryId` — history is preserved
- **Merge**: reassigns all transactions from a source category to a survivor, then soft-deletes the source. Runs in one `$transaction`

The UI shows a transaction count per category to inform merge/delete decisions.

## Account management

Brief overview only — see [accounts.md](accounts.md) for full details. `AccountManager.tsx` allows renaming, type-change, section-change, archive, and delete. Archived accounts are listed separately and can be unarchived.

## Feature toggles

| Toggle | `UserSettings` column | What it gates |
|--------|----------------------|--------------|
| Transactions | `transactionsEnabled` | Hides the Transactions nav item and page entirely |
| Budget transfers | `transfersEnabled` | Hides TRANSFER and REPAYMENT row types from the budget sheet |

No plan toggle exists — the Plan tab is always visible.

## Monthly reminder

Opt-in email sent on a chosen day of the month. Off by default. Configure via Settings → Reminder. See [reminders.md](reminders.md) for implementation details.

## Data privacy

All destructive actions require password re-entry (step-up auth). See [../engineering/step-up-auth.md](../engineering/step-up-auth.md).

| Action | What it does |
|--------|-------------|
| Export my data | Returns a JSON string (schema version 2) containing all 10 user-owned tables. Rate-limited: 2 exports/minute. |
| Clear my data | Deletes all financial rows (transactions, budget, balance, accounts, plan, periods). Keeps User, UserSettings, and Categories. |
| Reset to defaults | Same as clear, plus deletes categories, then re-seeds the starter data (41 categories, 6 accounts, £0 budget sheet). |
| Delete my account | Deletes all rows including User and UserSettings, then calls Supabase admin to erase the auth identity. Redirects to `/`. |

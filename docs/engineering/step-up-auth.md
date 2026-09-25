# Step-up Re-authentication

**What:** `verifyPassword()` calls Supabase `signInWithPassword` before any destructive data action; a live session alone is not sufficient.  
**Key points:**
- Protects: `resetToDefaults`, `clearMyData`, `deleteMyAccount` — all in `src/app/(app)/settings/dataActions.ts`
- Two rate-limit buckets: per-IP (5/min) + per-account (10/hr); both checked before the Supabase call
- UI: confirm button is disabled until the password field has content (never enabled by default)
- OAuth-only users (no password set) cannot currently use these actions — known gap, not a bug

Destructive data actions require the user to re-enter their password before the operation executes. A valid session alone is not sufficient.

## Protected actions

All three live in `src/app/(app)/settings/dataActions.ts`:

- `resetToDefaults(password)` — deletes all data and re-seeds defaults
- `clearMyData(password)` — deletes all financial rows
- `deleteMyAccount(password)` — deletes all rows and erases the Supabase auth identity

## Implementation

`verifyPassword(password: string)` is called at the top of each action, before any DB write:

1. Gets the current user's email via `supabase.auth.getUser()`
2. Checks two rate-limit buckets in parallel (see below)
3. Calls `supabase.auth.signInWithPassword({ email, password })` server-side
4. Throws `"Incorrect password"` on any auth error; throws rate-limit message if limited

The entire verify-then-write sequence is **not** in a database transaction — the password check is a Supabase call and cannot participate in a Prisma `$transaction`. If the password check passes but the DB write fails, the user must re-enter their password on retry.

## Rate limiting

Two buckets run in parallel via `checkRateLimit()` (`src/lib/rateLimit/index.ts`):

| Bucket | Key | Limit |
|--------|-----|-------|
| `verify-password` | Client IP | 5 attempts / minute |
| `verify-password-account` | Account email (SHA-256) | 10 attempts / hour |

The per-IP bucket bounds a single attacker from one location. The per-account bucket bounds a pool of IPs guessing at one account's password. Both use `whenStoreFails: "allow"` — a Redis outage does not lock the user out of their own account.

## UI

`DataPrivacy.tsx` (`src/app/(app)/settings/DataPrivacy.tsx`):

- Each `WarningBox` panel contains a `<input type="password" autoComplete="current-password">` field
- The confirm button is `disabled` until the password field is non-empty
- The delete-account confirm button additionally requires the text field to contain exactly `"DELETE"`
- Server error messages are mapped through a `SERVER_ERRORS` lookup to user-facing strings; unmapped errors fall back to a generic message

The `password` state is reset to `""` on cancel and on action completion.

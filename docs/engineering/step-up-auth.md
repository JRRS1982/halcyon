# Step-up Re-authentication

**What:** `verifyUser()` proves the caller is the account holder before any destructive data action; a live session alone is not sufficient.  
**Key points:**
- Protects: `exportMyData`, `resetToDefaults`, `clearMyData`, `deleteMyAccount` — all in `src/app/(app)/settings/dataActions.ts`
- Which proof applies is read from the account's identities, **server-side** — never guessed; an unreadable classification fails closed rather than defaulting
- The client picks which control to *render*; it does not pick the gate — `verifyUser` re-derives the method and rejects a mismatched proof
- OAuth-only accounts can use these actions, by an emailed 6-digit code. Before October 2026 they could not, which closed the right-to-erasure path for every Google user. The code path depends on dashboard settings — custom SMTP, a code-only template and a 6-digit OTP length — listed in [Supabase email setup](../features/auth.md#supabase-email-setup)

Destructive data actions require the user to re-prove who they are before the operation executes. A valid session alone is not sufficient.

`exportMyData` is in that list despite destroying nothing: it hands over the entire financial record, which is at least as sensitive as deleting it. It was added in October 2026 after an audit found it was the only one of the four without a gate — an unlocked signed-in browser was a complete breach. `docs/features/settings.md` had claimed all four were protected since PR #208, so the documentation was describing the intent rather than the code.

## Protected actions

All three live in `src/app/(app)/settings/dataActions.ts`:

- `exportMyData(proof)` — returns every user-owned row as JSON
- `resetToDefaults(proof)` — deletes all data and re-seeds defaults
- `clearMyData(proof)` — deletes all financial rows
- `deleteMyAccount(proof)` — deletes all rows and erases the Supabase auth identity

`proof` is a `Reauthentication` (`src/lib/auth/reauth.ts`), a discriminated union:

```ts
type Reauthentication =
  | { method: "password"; password: string }
  | { method: "otp"; code: string };
```

## Which proof an account offers

`reauthMethodFor(identities)` (`src/lib/auth/reauth.ts`) is pure and has no imports. An `email` identity means the account has a password; a Google-only account gets a one-time code.

**It never guesses.** An account signed up as one thing or the other and that is recorded, so this is a fact to read. GoTrue refuses to unlink a user's last identity (`"User must have at least 1 identity after unlinking"`, `internal/api/identity.go`) and this app has no anonymous sign-in, so every signed-in account carries at least one. An empty list is therefore a broken read, not a user state, and the function returns `null` rather than defaulting.

That matters because neither default is safe. Defaulting to the code would hand a password account's gate to whoever can read its inbox — the exact downgrade the server-side check exists to refuse. Defaulting to the password would lock a Google account out of erasing its own data — the original bug. So `null` fails closed at both consumers: the server logs and redirects to sign-in, and the panel renders no control, which leaves every confirm button disabled by construction rather than by a guard someone could forget.

A linked account holding both an `email` and a `google` identity gets the **password**: it has one to type.

It is consulted in two places, for two different reasons:

- `src/app/(app)/settings/page.tsx` — to choose which control the panel renders
- `verifyUser` — to decide which proof is **acceptable**

The second is the security boundary. `proof.method` arrives from the browser, so without the server-side re-derivation an attacker holding a stolen session on a password account could request a code and swap the gate from *knows the password* to *can read the inbox*. Since password reset shipped (Oct 2026), inbox access can also set a new password, so the two are closer than they were — but the check still stops a stolen session *without* the inbox from choosing the weaker-looking gate, and it keeps a password account's proof the one the owner actually set.

## Implementation

`verifyUser(proof)` is called at the top of each action, before any DB write:

1. Gets the current user via `supabase.auth.getUser()`; an account with no email redirects to sign-in rather than failing obscurely
2. Re-derives the expected method from `user.identities` and rejects a proof that does not match
3. Checks the two shared rate-limit buckets in parallel (see below)
4. **Password branch:** `supabase.auth.signInWithPassword({ email, password })`; throws `"Incorrect password"` on any auth error
5. **Code branch:** checks the `verify-code` bucket, then `supabase.auth.verifyOtp({ email, token, type: "email" })`; logs the provider error server-side and throws `"That code is not valid"`

`sendReauthCode()` mails the code. It refuses for an account that has a password, for the same reason step 2 does.

Both verification calls mint a fresh session as a side effect — that is how Supabase's verification endpoints work. The caller already holds a valid session for the same user, so this refreshes rather than escalates, but it does mean each confirmation leaves an extra live session behind.

The entire verify-then-write sequence is **not** in a database transaction — verification is a Supabase call and cannot participate in a Prisma `$transaction`. If verification passes but the DB write fails, the user must re-prove on retry.

## Rate limiting

Four buckets, via `checkRateLimit()` (`src/lib/rateLimit/index.ts`):

| Bucket | Key | Limit | On store failure |
|--------|-----|-------|------------------|
| `verify-password` | Client IP | 5 / minute | allow |
| `verify-password-account` | Account email (SHA-256) | 10 / hour | allow |
| `reauth-code` | Account email (SHA-256) | 5 / hour | allow |
| `verify-code` | Account email (SHA-256) | 10 / hour | **block** |

The first two run in parallel for every call, whichever proof is being offered: the per-IP bucket bounds a single attacker from one location, the per-account bucket bounds a pool of IPs guessing at one account.

`reauth-code` is 5/hour: room for "Send another code" when the first lands in spam, and each send is still an email. It was 2/hour while Supabase's built-in sender capped the whole project at 2/hour; custom SMTP (Resend) lifted that cap in October 2026.

`verify-code` is the one bucket that fails **closed**, and the asymmetry is deliberate. A password has real entropy behind it and survives an unbounded guessing window; a 6-digit code valid for an hour is 10⁶, and GoTrue does not count failed email-OTP verifies itself. That bucket is therefore the entire guess budget, so losing the store must stop verification rather than open it.

## UI

`DataPrivacy.tsx` (`src/app/(app)/settings/DataPrivacy.tsx`) takes `method` as a prop, resolved by the page, and all three `WarningBox` panels share one control:

- **Password accounts:** `<input type="password" autoComplete="current-password">`, exactly as before
- **Code accounts:** an "Email me a code" button, then `<input inputMode="numeric" autoComplete="one-time-code">` plus a "Send another code" affordance
- The confirm button is `disabled` until the field is non-empty
- The delete-account confirm button additionally requires the text field to contain exactly `"DELETE"`
- Actions return `{ ok: false, reason }` rather than throwing (a thrown message reaches a production browser only as a digest); the panel reads the words from `REAUTH_MESSAGES` in `src/lib/auth/reauthOutcome.ts`, and an unmapped error falls back to a generic message

The typed secret is cleared on cancel and on completion, but **`codeSent` is not** — a code lives for an hour and sends are capped per hour, so closing a panel must not throw away the only route to typing one that already arrived.

The copy deliberately says "your account doesn't have a password" rather than naming Google: a second provider would make the specific claim wrong.

## Known gaps

- **Password reset makes the inbox a route to the password.** Revisited when reset shipped: the server-side method check stays, for the reason above, but it is no longer the only thing standing between inbox access and a password account's data.
- **The code path depends on dashboard settings this repo cannot see.** Custom SMTP, the code-only "Magic link or OTP" template and an Email OTP Length of 6 — see [Supabase email setup](../features/auth.md#supabase-email-setup). In October 2026 the OTP length was 8, and every code was refused; a malformed code now reads as "That code is not valid", and any unmapped error in these actions is logged.

# Step-up Re-authentication

**What:** `verifyUser()` proves the caller is the account holder before any destructive data action; a live session alone is not sufficient.  
**Key points:**
- Protects: `resetToDefaults`, `clearMyData`, `deleteMyAccount` — all in `src/app/(app)/settings/dataActions.ts`
- Which proof applies is decided from the account's identities, **server-side**: a password for accounts that have one, a one-time emailed code for accounts that don't
- The client picks which control to *render*; it does not pick the gate — `verifyUser` re-derives the method and rejects a mismatched proof
- OAuth-only accounts can use these actions. Before October 2026 they could not, which closed the right-to-erasure path for every Google user

Destructive data actions require the user to re-prove who they are before the operation executes. A valid session alone is not sufficient.

## Protected actions

All three live in `src/app/(app)/settings/dataActions.ts`:

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

`reauthMethodFor(identities)` (`src/lib/auth/reauth.ts`) is pure and has no imports. An `email` identity means the account has a password; everything else — a Google-only account, or identities that did not come back from `getUser()` — falls to a one-time code, which works for any confirmed account.

A linked account holding both an `email` and a `google` identity gets the **password**: it has one to type.

It is consulted in two places, for two different reasons:

- `src/app/(app)/settings/page.tsx` — to choose which control the panel renders
- `verifyUser` — to decide which proof is **acceptable**

The second is the security boundary. `proof.method` arrives from the browser, so without the server-side re-derivation an attacker holding a stolen session on a password account could request a code and swap the gate from *knows the password* to *can read the inbox*. With no password-reset flow in this app, those are not equivalent.

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
| `reauth-code` | Account email (SHA-256) | 2 / hour | allow |
| `verify-code` | Account email (SHA-256) | 10 / hour | **block** |

The first two run in parallel for every call, whichever proof is being offered: the per-IP bucket bounds a single attacker from one location, the per-account bucket bounds a pool of IPs guessing at one account.

`reauth-code` is 2/hour to match the real constraint rather than sit above it — Supabase's built-in sender caps the whole project at 2/hour, so a looser bucket would never bind and the user would get a generic send failure instead of being told they have asked for too many codes.

`verify-code` is the one bucket that fails **closed**, and the asymmetry is deliberate. A password has real entropy behind it and survives an unbounded guessing window; a 6-digit code valid for an hour is 10⁶, and GoTrue does not count failed email-OTP verifies itself. That bucket is therefore the entire guess budget, so losing the store must stop verification rather than open it.

## UI

`DataPrivacy.tsx` (`src/app/(app)/settings/DataPrivacy.tsx`) takes `method` as a prop, resolved by the page, and all three `WarningBox` panels share one control:

- **Password accounts:** `<input type="password" autoComplete="current-password">`, exactly as before
- **Code accounts:** an "Email me a code" button, then `<input inputMode="numeric" autoComplete="one-time-code">` plus a "Send another code" affordance
- The confirm button is `disabled` until the field is non-empty
- The delete-account confirm button additionally requires the text field to contain exactly `"DELETE"`
- Server error messages are mapped through a `SERVER_ERRORS` lookup; unmapped errors fall back to a generic message

The typed secret is cleared on cancel and on completion, but **`codeSent` is not** — a code lives for an hour and only two can be sent per hour, so closing a panel must not throw away the only route to typing one that already arrived.

The copy deliberately says "your account doesn't have a password" rather than naming Google: a second provider would make the specific claim wrong, and it is already wrong for a password account whose identities came back empty.

## Known gaps

- **No password reset or change flow anywhere in the app.** This is what makes mailbox access non-equivalent to password knowledge, and therefore what makes the server-side method check load-bearing. If a reset flow is added, revisit that reasoning.
- **Email OTP must be enabled in the Supabase dashboard** (Authentication → Providers → Email). GoTrue gates the magic-link path on `External.Email.MagicLinkEnabled`; with it off, every code account fails. The provider error is logged server-side so this is diagnosable rather than silent.
- **`SERVER_ERRORS` assumes thrown server-action messages reach the client verbatim.** Next may replace them with a generic string plus a digest in production builds. This predates the code branch — `"Incorrect password"` has the same exposure — but it is worth confirming empirically, because the readable distinction between "wrong code" and "too many attempts" rests on it.

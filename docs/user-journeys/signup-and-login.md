# User Sign-up and Login

**Journey:** A visitor creates an account (or signs in), and lands in the app.  
**Outcome:** Authenticated session on `/transactions`, with default categories, accounts and a £0 budget sheet already created.

```mermaid
flowchart TD
    A[Visit homepage] --> B{User action}
    B -->|Sign up| C[/sign-up]
    B -->|Sign in| D[/sign-in]

    C --> E{Method}
    E -->|Email + password| G[Create account]
    E -->|Continue with Google| GG[Google consent]
    G --> I["Check your email" notice + confirmation email]
    I --> J[Click link → /auth/callback]
    GG --> J
    J --> M[/transactions, signed in]

    D --> N{Method}
    N -->|Email + password| O[Sign in]
    N -->|Continue with Google| GG
    N -->|Forgot your password?| R[/forgot-password]
    O -->|Success| M
    O -->|Failure| P[Error shown on /sign-in]
    P --> D
    R --> S[Email with reset link → /reset-password]
    S --> T[Save new password]
    T --> M
```

## Sign up

1. Click **Get started** on the landing page (`/sign-up`, "Create your account").
2. Either enter an email and a password of at least 12 characters and press **Create account**, or press **Continue with Google**.
3. Email sign-ups see "Check your email for a confirmation link to finish signing up." The same notice appears for an address that already has an account, so the page never reveals which addresses are registered.
4. The confirmation link goes to `/auth/callback`, which exchanges the one-time code for a session and sends the user to `/transactions`. There is no second sign-in step. Google sign-ups reach the same callback straight from Google's consent screen.

Sign-up refuses passwords that appear in a known breach (via Have I Been Pwned; if that service is down, the sign-up goes ahead) and is rate-limited per IP and per address.

## Sign in

1. Click **Sign in** on the landing page (`/sign-in`).
2. Enter email and password and press **Sign in**, or press **Continue with Google**.
3. On success the user goes to `/transactions`, or to the `?next=` page they were originally heading for.
4. On failure the page shows "Email or password is incorrect." and the user can retry.

## Forgot password

1. On `/sign-in`, click **Forgot your password?** (`/forgot-password`) and press **Send reset link**. The page says a link is on its way if an account uses that address.
2. The email links to `/reset-password`. Enter a new password (12 characters or more) and press **Save new password**.
3. The user is signed in, every other session is signed out, and they land on `/transactions`.

Accounts that sign in with Google have no password: the reset is refused with a message to use **Continue with Google**. An expired or used link sends the user back to `/forgot-password` for a new one.

## Email confirmation

The Supabase dashboard's "Confirm email" setting controls whether sign-ups need a confirmation link. The app treats an unconfirmed address as signed out, so it cannot reach any protected route. Google sign-ins skip the email step.

## Notes

- **Onboarding provisioning:** on a new user's first authenticated page load, `provisionUserSettings` (`src/lib/settings/server.ts`) seeds default categories, accounts and a £0 budget sheet for the current month, so they never see an empty app.
- **Session limits:** idle and absolute timeouts apply to every signed-in user. See [session-timeout.md](session-timeout.md).

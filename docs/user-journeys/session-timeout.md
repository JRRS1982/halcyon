# User Journey: Session Timeout

**Journey:** A user leaves the app idle and returns to find their session has expired.  
**Outcome:** User signs in again and lands back at their original destination.

## Timeout limits

| Limit | Value |
|-------|-------|
| Idle timeout | 6 hours without a click, key press, scroll or touch |
| Absolute cap | 24 hours from sign-in, regardless of activity |
| Warning before idle expiry | 60 seconds |

Two parts enforce this. The client `IdleTimeout` component (`src/components/auth/IdleTimeout/`) warns and signs out gracefully. The server proxy (`src/proxy.ts`, logic in `src/lib/supabase/middleware.ts`) is the enforcing half: it checks the `bm_activity` cookie on every request, including for browsers closed without signing out.

## Flow

```mermaid
flowchart TD
    A[User leaves app idle] --> B{Idle for 5h 59m?}
    B -->|No| A
    B -->|Yes| C["'Still there?' modal\n60-second countdown"]
    C --> D{User responds?}
    D -->|Stay signed in| E[Page refreshes; proxy resets\nactivity cookie]
    D -->|Sign out, or no response in 60s| F[signOutIdle\nredirect to /sign-in?timeout=idle]
    F --> G[Sign-in page shows the reason]
    G --> H[User signs in]
    H --> I[/transactions, or the ?next= destination]

    J[User returns after 24 hours] --> K[Proxy ends session\nredirect to /sign-in?timeout=absolute]
    K --> G
```

## Steps

### Warning modal

Sixty seconds before idle expiry, a modal titled **Still there?** shows a countdown. Escape does not dismiss it. **Stay signed in** refreshes the page, which passes through the proxy and resets the activity cookie. **Sign out** ends the session at once.

### After expiry

If the warning is ignored, `signOutIdle` signs out of Supabase and redirects to `/sign-in?timeout=idle`. The sign-in page shows a notice for the `timeout` value:

- `idle`: "You were signed out after a period of inactivity."
- `absolute`: "You were signed out because your session reached its time limit."
- `unreadable`: "We couldn't confirm how long you'd been signed in, so we signed you out. Please sign in again." This happens when the activity cookie is missing or malformed.

After signing in, `?next=` (if present) restores the original destination; otherwise the user lands on `/transactions`.

### Absolute cap

After 24 hours from sign-in, the proxy ends the session on the next request and redirects to `/sign-in?timeout=absolute`. There is no warning for the cap.

### Proxy enforcement

A session left in a closed browser expires the moment someone opens the app again. The client component is the courteous half; the proxy is what actually ends sessions.

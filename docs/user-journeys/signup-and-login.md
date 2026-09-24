# User Sign-up and Login

This flowchart is an example of a user journey of the user signing up to the application and completing their first onboarding steps.

```mermaid
flowchart TD
    %% Authentication Flow
    A[Start: Visit Homepage] --> B{User Action}
    B -->|Sign Up| C[Sign Up Form]
    B -->|Log In| D[Login Form]

    %% Sign Up Path
    C --> E[Enter Email/Password or use OAuth provider]
    E --> G[Submit]
    G --> I[Send Verification Email]
    I --> J[User Verifies Email / OAuth callback]
    J --> K[Account ready — redirect to sign-in]

    %% Post-Authentication
    K --> M[/transactions]

    %% Login Path
    D --> N[Enter Credentials or use OAuth provider]
    N --> O[Authenticate]
    O -->|Success| M
    O -->|Failure| P[Show Error]
    P --> D

    %% Styling
    classDef userAction fill:#d4f1f9,stroke:#333,stroke-width:2px
    classDef systemAction fill:#d5e8d4,stroke:#333,stroke-width:2px
    classDef decision fill:#fff2cc,stroke:#333,stroke-width:2px

    %% Apply styles
    class A,B,C,D,E,G,N,O,P userAction
    class I,J,K,M systemAction
```

## Authentication Flow Details

### Sign Up Process

1. User clicks "Sign Up" on the homepage
2. User enters their email and creates a password, or chooses to sign up using Google OAuth
3. System sends a verification email (email/password) or completes the OAuth callback (Google)
4. User verifies email / OAuth completes — account is ready, user is redirected to sign-in
5. After signing in, user is directed to `/transactions` (the default post-auth landing)

### Login Process

1. User clicks "Log In" on the homepage
2. User enters their credentials, or chooses to log in using an OAuth provider (Google, etc.)
3. System authenticates the user
4. On success: User is directed to `/transactions` (the default post-auth landing)
5. On failure: Error message is shown and user can try again

### Email Verification

Verification is controlled entirely by the Supabase dashboard "Confirm email" toggle — the app code does not branch on this. With the toggle on (default), email/password sign-ups receive a confirmation link before their account activates. OAuth sign-ups bypass email verification via the provider's own flow.

## Notes

- **Onboarding provisioning**: on first authenticated page load, `provisionUserSettings` (`src/lib/settings/server.ts`) silently seeds default categories, accounts, and a £0 budget sheet for the current month. The user lands on `/transactions` with data already present — they never see an empty app.
- **Session timeout**: an idle timeout is active for all authenticated users. After inactivity the session is signed out automatically (`src/components/auth/IdleTimeout/`).
- **Password reset**: no reset route exists in the app UI. Password reset goes through Supabase's own email flow; it is not surfaced on the sign-in page yet.

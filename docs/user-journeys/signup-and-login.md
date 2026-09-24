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
    E --> F[Accept Terms & Privacy]
    F --> G[Submit]
    G --> H{Email Verification Required?}
    H -->|Yes| I[Send Verification Email]
    H -->|No| K[Create Account]
    I --> J[User Verifies Email]
    J --> K

    %% Post-Authentication
    K --> M[User Dashboard]

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
    class A,B,C,D,E,F,G,N,O,P userAction
    class H,I,J,K,M systemAction
    class H decision
```

## Authentication Flow Details

### Sign Up Process

1. User clicks "Sign Up" on the homepage
2. User enters their email and creates a password, or chooses to sign up using an OAuth provider (Google, etc.)
3. User accepts terms and privacy policy
4. System checks if email verification is required (based on authentication method)
   - If using email/password: Verification email is sent
   - If using OAuth (Google, etc.): Verification handled by provider
5. After successful verification/authentication, user is directed to their dashboard

### Login Process

1. User clicks "Log In" on the homepage
2. User enters their credentials, or chooses to log in using an OAuth provider (Google, etc.)
3. System authenticates the user
4. On success: User is directed to their dashboard
5. On failure: Error message is shown and user can try again

### Email Verification

- **Required for**: Email/Password signup
- **Skipped for**: OAuth providers (Google, etc.)
- **Process**:
  1. Verification link sent to user's email
  2. User clicks link to verify
  3. Account is activated and user can log in or is logged in if they are still on the page

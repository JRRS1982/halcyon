// The seeded demo account (see prisma/seed.ts, which creates this user in cloud
// Supabase Auth and the matching local data). Surfaced as a one-click
// "Log in as demo" button on /sign-in — DEVELOPMENT ONLY.
//
// Keep these in sync with prisma/seed.ts's DEMO_EMAIL / DEMO_PASSWORD.
export const DEMO_EMAIL = "demo@halcyon.local";
export const DEMO_PASSWORD = "halcyon-demo";

// Whether to expose the demo-login button. `process.env.NODE_ENV` is inlined at
// build time in client code, so the button is dead-code-eliminated from the
// production bundle; the server action also re-checks at runtime as a guard.
export const demoLoginEnabled = process.env.NODE_ENV !== "production";

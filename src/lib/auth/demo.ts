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

// Supabase projects the seed is allowed to create the demo auth user in.
//
// The seed's existing guard asserts DATABASE_URL points at local Postgres. That
// is the wrong connection: auth users are not written through Prisma, they go
// to whatever NEXT_PUBLIC_SUPABASE_URL names. So a .env holding a local
// DATABASE_URL and the production Supabase URL passed the guard and would have
// minted demo@halcyon.local — whose password is published in this repo — in
// production auth, reachable from the ordinary sign-in form.
//
// An allow-list rather than a deny-list, so an unfamiliar project fails closed.
// The ref is a public identifier (it ships in every page bundle), not a secret.
// Adding one should be a deliberate edit, which is the point.
export const SEEDABLE_PROJECT_REFS = ["cxoefsvzkyswzbtztchj"] as const;

export const isSeedableAuthProject = (
  supabaseUrl: string | undefined,
): boolean => {
  if (!supabaseUrl) return false;
  let host: string;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
  // Local stacks (Supabase CLI, the e2e mock) are always fine: they hold no
  // real accounts, and refusing them would break offline development.
  if (host === "localhost" || host === "127.0.0.1") return true;
  const ref = host.split(".")[0] ?? "";
  return (SEEDABLE_PROJECT_REFS as readonly string[]).includes(ref);
};

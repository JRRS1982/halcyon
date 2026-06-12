import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. SERVER-ONLY — never import from a client
// component. The `server-only` import above makes an accidental client import
// a build-time error rather than a silent key leak.
//
// Halcyon splits user data across two stores (see docs/features/auth.md):
//   • identity → Supabase-managed `auth.users` (email, password hash, OAuth)
//   • profile  → our `public."User"` + the financial tables (Prisma)
//
// The request-scoped client (publishable key, src/lib/supabase/server.ts) is
// bound to the signed-in user and is NOT permitted to delete an `auth.users`
// row. True account erasure (the GDPR right-to-erasure) therefore requires
// Supabase's Admin API, which needs the service-role secret key. That key
// bypasses Postgres RLS, so this module's only caller is the `deleteMyAccount`
// server action.
export function createAdminClient() {
  return createClient(
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: server-only secret
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Use in client components (`"use client"`).
// Reads session from cookies; subject to RLS via the publishable key.
export const createClient = () =>
  createBrowserClient(
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup via env schema
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup via env schema
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

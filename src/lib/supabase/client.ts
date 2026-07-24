import { env } from "@/lib/env";
import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Use in client components (`"use client"`).
// Reads session from cookies; subject to RLS via the publishable key.
export const createClient = () =>
  createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

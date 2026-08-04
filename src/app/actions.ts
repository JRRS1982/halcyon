"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const endSession = async (search: string) => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/sign-in${search}`);
};

export const signOut = async () => endSession("");

// The client-side idle timer's counterpart to the proxy's own expiry redirect
// (`src/lib/supabase/middleware.ts`). Carries the same `timeout` param so the
// sign-in page can explain itself either way.
export const signOutIdle = async () => endSession("?timeout=idle");

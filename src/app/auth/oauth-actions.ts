"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Initiates the Google OAuth flow. Supabase returns a URL pointing at Google's
// consent screen; we redirect the browser there. Google then redirects back to
// Supabase, which redirects back to our /auth/callback with a one-time code
// that the existing callback route exchanges for a session.
export const signInWithGoogle = async () => {
  const origin = headers().get("origin");
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/sign-in?error=${encodeURIComponent(error?.message ?? "Could not start Google sign-in")}`,
    );
  }

  redirect(data.url);
};

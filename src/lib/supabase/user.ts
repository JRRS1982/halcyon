import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { isEmailConfirmed } from "@/lib/auth/confirmed";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for the current request, or null.
 *
 * `supabase.auth.getUser()` is a network call to the Supabase auth API, and
 * the render path used to make it several times over: the root layout asked
 * once for the nav, `getCurrentUserSettings` asked again, and the page asked a
 * third time — on top of the proxy's own check. React's `cache()` scopes the
 * result to a single request, so a render pass makes one call however many
 * components need the user.
 *
 * It does NOT cache across requests: `cache()` is per-request memoisation, so
 * a signed-out user never sees a previous request's session.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // An unconfirmed address is not an identity. Treated as signed out rather
  // than trusted, so the guarantee lives in code instead of in a dashboard
  // toggle this repo cannot see.
  if (user && !isEmailConfirmed(user)) return null;
  return user;
});

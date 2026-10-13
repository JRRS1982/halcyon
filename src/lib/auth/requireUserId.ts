import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * The signed-in user's id, or a redirect to sign-in.
 *
 * There were nine copies of this, one per server-action file. Six called
 * `supabase.auth.getUser()` directly and so never saw the email-confirmed
 * check that getCurrentUser applies — a fence with a gap in it is not a fence,
 * and the gap was invisible precisely because every copy looked correct on its
 * own.
 *
 * Going through getCurrentUser also means the auth round-trip is memoised per
 * request (React `cache()`), so an action that needs the id twice, or a page
 * whose layout already asked, no longer pays for a second network call.
 *
 * `next` is where to return the user after signing in — the only thing the
 * nine copies actually differed on.
 */
export const requireUserId = async (next: string): Promise<string> => {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${next}`);
  return user.id;
};

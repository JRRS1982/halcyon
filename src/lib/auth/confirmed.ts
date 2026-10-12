import type { User } from "@supabase/supabase-js";

/**
 * Whether Supabase has confirmed this account's email address.
 *
 * Until October 2026 nothing in this codebase asked. Verification rested
 * entirely on the dashboard's "Confirm email" toggle, which is invisible to the
 * repo and to CI — so if it were ever switched off, by a settings change or a
 * project restored from different config, `signUp` would return a live session
 * and the app would accept it. Someone could then use the whole app under an
 * address they do not own, including switching on the monthly reminder, which
 * mails that address.
 *
 * Shared rather than inlined so the proxy and getCurrentUser cannot drift:
 * a fence applied in one place and not the other is not a fence.
 */
export const isEmailConfirmed = (user: Pick<User, "email_confirmed_at">) =>
  Boolean(user.email_confirmed_at);

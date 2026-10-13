import { headers } from "next/headers";
import { emailEnv } from "@/lib/env";

/**
 * The origin to build an auth redirect from.
 *
 * Prefers SITE_URL, which the server owns, over the request's Origin header,
 * which the client sends. The header reached `emailRedirectTo` on sign-up and
 * `redirectTo` on OAuth, so a forged one could point the confirmation link's
 * one-time code at another host. Two guards had to fail for that to work —
 * Next requires Origin to match host on a server action, and Supabase only
 * honours redirects on its own allow-list — but neither is this code's doing,
 * and neither is visible from here.
 *
 * SITE_URL is required on a production Vercel deploy (src/lib/env.ts), so the
 * header fallback below only ever applies to local development and preview
 * deploys, where there is no fixed origin to know in advance.
 */
export const callbackOrigin = async (): Promise<string | null> =>
  emailEnv.SITE_URL ?? (await headers()).get("origin");

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/http/clientIp";

// The app runs on Vercel, so every call to Supabase Auth leaves from one of a
// small pool of egress IPs. Left alone, Supabase's per-IP rate limits (sign-up
// email throttle, sign-in token throttle) collapse into a single shared bucket
// for the whole app — useless for isolating an attacker and prone to throttling
// real users instead. Forwarding the true client IP restores per-attacker
// keying.

// Server Supabase client. Use in server components, route handlers, and
// server actions. Reads/writes the session cookies on the current request.
// Async because Next 15+ makes cookies() a Promise.
export const createClient = async () => {
  const cookieStore = await cookies();
  const ip = await clientIp();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: ip ? { headers: { "X-Forwarded-For": ip } } : undefined,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll was called from a Server Component — cookies are read-only
            // there, and the middleware refreshes the session on every request,
            // so we can safely ignore this case.
          }
        },
      },
    },
  );
};

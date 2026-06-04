import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client. Use in server components, route handlers, and
// server actions. Reads/writes the session cookies on the current request.
// Async because Next 15+ makes cookies() a Promise.
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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

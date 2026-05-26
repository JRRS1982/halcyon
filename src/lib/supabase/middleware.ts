import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Called from `src/middleware.ts` on every request. Refreshes the Supabase
// session cookies so that server components see a current user, and (optionally)
// redirects unauthenticated requests away from protected paths.
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: validated at app startup
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not run any other code between createServerClient and
  // getUser. The call refreshes the session cookies in `supabaseResponse`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protection: any path starting with one of these requires a session.
  // Unauthenticated visits get redirected to /sign-in with `?next=...` so the
  // user can be sent back where they were heading after they log in.
  const protectedPaths = ["/dashboard", "/budget", "/balance", "/settings"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
};

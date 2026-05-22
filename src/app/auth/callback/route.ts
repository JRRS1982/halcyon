import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Called by Supabase Auth after email confirmation, magic-link click, or OAuth
// provider redirect. Exchanges the one-time `code` query param for a session
// cookie, then forwards the user to wherever they were heading.
export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Missing auth code")}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
};

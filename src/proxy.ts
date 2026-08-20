import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed middleware to proxy (src/proxy.ts, `proxy` export). This is
// the route-protection boundary: it refreshes the Supabase session and
// redirects unauthenticated requests — see docs/features/auth.md.
export const proxy = (request: NextRequest) => updateSession(request);

export const config = {
  // Run on every request except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

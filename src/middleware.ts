import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export const middleware = (request: NextRequest) => updateSession(request);

export const config = {
  // Run on every request except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { headers } from "next/headers";

// The real client IP for the current request. On Vercel `x-forwarded-for` is
// set by the platform edge (not client-spoofable) and its first hop is the
// client; `x-real-ip` is the fallback. Returns null when neither is present.
//
// Used to forward the client IP to Supabase (so its per-IP throttles bind — see
// src/lib/supabase/server.ts) and to key the app-side rate limiter.
export const clientIp = async (): Promise<string | null> => {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return store.get("x-real-ip");
};

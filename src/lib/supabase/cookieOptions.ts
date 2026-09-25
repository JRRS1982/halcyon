// Attributes for the Supabase session cookies (`sb-*-auth-token`).
//
// `@supabase/ssr` defaults to `httpOnly: false` so that a browser-side Supabase
// client can read the session. This app has no browser-side client — every
// Supabase call is made from the server (see docs/features/auth.md) — so the
// tokens are marked HttpOnly and script on the page cannot read them. This is
// what turns a future XSS from "steal the session" into "act only while the
// page is open". Shared by the server client and the proxy client so the two
// can never disagree about the cookie's shape.
//
// `secure` follows the environment for the same reason the activity cookie's
// does (src/lib/auth/sessionTimeout.ts): local dev and the e2e server are plain
// http, and Safari drops a Secure cookie set over http.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

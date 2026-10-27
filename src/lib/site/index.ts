// The public, canonical origin: the host that actually serves pages. The apex
// (balanced.money) 308s here, so search engines should be given this one —
// a sitemap of redirecting URLs is one they have to correct for themselves.
export const CANONICAL_ORIGIN = "https://www.balanced.money";

// The pages a stranger can usefully land on from a search. The app's own
// pages need a session, and the auth helpers (reset links, unsubscribe,
// the OAuth callback) only make sense from an email or a redirect.
export const PUBLIC_PAGES = [
  "/",
  "/guide",
  "/how-its-built",
  "/design",
  "/sign-up",
  "/sign-in",
  "/privacy",
  "/cookies",
  "/terms",
] as const;

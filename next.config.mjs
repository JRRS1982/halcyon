const isDev = process.env.NODE_ENV === "development";

// Supabase's origin, for the one place the browser talks to it: the
// no-JavaScript "Continue with Google" form, whose redirect chain runs through
// Supabase and then Google. form-action applies to redirects after a submit.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// The policy on trial. Report-only: browsers block nothing and send what they
// would have blocked to /api/csp-report, which counts it in Upstash. Enforce it
// (rename the header) once a trial shows only noise such as extensions.
//
// No nonces, so inline scripts and styles stay allowed: Next and
// styled-components both emit them, and nonces would force every page —
// the static landing page included — to render per request. What this still
// stops: scripts and styles from other hosts, plugins, <base> hijacking, forms
// posting elsewhere, and connections to unknown servers. Development adds
// 'unsafe-eval' (React's dev tooling) and websockets (hot reload).
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabaseOrigin} https://accounts.google.com`,
  "frame-ancestors 'none'",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  compiler: {
    styledComponents: true,
  },
  images: {
    // The marketing screenshots all render through next/image, so the source
    // PNGs are never what a visitor downloads — the optimiser resizes and
    // re-encodes them per request. Default output is WebP only; adding AVIF
    // ahead of it means browsers that support it (most now) get the smaller
    // encode, and the rest fall back to WebP automatically.
    formats: ["image/avif", "image/webp"],
  },
  // Browser protections the app opts into on every response. HSTS is not
  // here: Vercel already sends it for the whole domain. The enforced CSP
  // carries only frame-ancestors, which restricts nothing but framing; the
  // fuller policy above runs report-only alongside it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: no other site may load these pages in a frame and
          // trick a click on "Delete account". frame-ancestors is the modern
          // control; X-Frame-Options covers older browsers.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
          // Where Chromium sends reports named by `report-to csp`; Firefox
          // and Safari use `report-uri`.
          { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
          // Never guess a response's type: a file served as text stays text.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Reset links carry a token in the URL. Other sites are told only
          // which site a visitor came from, never the full address.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app uses no camera, microphone or location, so nothing on its
          // pages — including anything injected — may ask for them.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
  // The guide lived at /about first. It is a public page, so the old path is
  // in browser histories and anywhere it was ever shared — a permanent
  // redirect keeps those working and tells crawlers which URL is the real one.
  async redirects() {
    return [{ source: "/about", destination: "/guide", permanent: true }];
  },
  // /design and /design.md both read DESIGN.md from the repository root at
  // request time. Nothing imports it, so Next's dependency trace cannot see it
  // and would leave it out of the server bundle — the read then works locally,
  // where the whole repo is on disk, and throws ENOENT on Vercel.
  outputFileTracingIncludes: {
    "/design": ["./DESIGN.md"],
    "/design.md": ["./DESIGN.md"],
  },
  experimental: {
    serverActions: {
      // CSV import posts parsed rows as JSON, which outgrows the 1MB default
      // well before the row cap is reached. Keep in step with
      // MAX_IMPORT_FILE_BYTES in src/lib/transactions/limits.ts.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;

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
  // here: Vercel already sends it for the whole domain. A full
  // Content-Security-Policy (which scripts may run) is not built yet — Next
  // and styled-components inline scripts and styles, so it needs per-request
  // nonces and a report-only trial first. The one directive below,
  // frame-ancestors, restricts nothing but framing, so it is safe on its own.
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

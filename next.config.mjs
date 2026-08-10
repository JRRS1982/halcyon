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
  // The guide lived at /about first. It is a public page, so the old path is
  // in browser histories and anywhere it was ever shared — a permanent
  // redirect keeps those working and tells crawlers which URL is the real one.
  async redirects() {
    return [{ source: "/about", destination: "/guide", permanent: true }];
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

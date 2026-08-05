/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  compiler: {
    styledComponents: true,
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

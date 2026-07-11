/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;

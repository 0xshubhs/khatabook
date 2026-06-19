/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Internal workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ["@khatabook/shared"],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@nexora/ui", "@nexora/auth", "@nexora/billing", "@nexora/db", "@nexora/utils"],
};

module.exports = nextConfig;

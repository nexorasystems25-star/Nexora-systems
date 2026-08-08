/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@nexora/ui", "@nexora/auth", "@nexora/billing", "@nexora/db", "@nexora/utils"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;

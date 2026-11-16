import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  images: {
    // space photos are hosted by NC State Libraries
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.lib.ncsu.edu",
        pathname: "/sites/default/files/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

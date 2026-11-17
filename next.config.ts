import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // Hunt used to be the whole site, so its old URLs still work. Not permanent: "/" will become a library picker.
  redirects: async () => [
    { source: "/", destination: "/hunt", permanent: false },
    { source: "/trends", destination: "/hunt/trends", permanent: false },
  ],
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

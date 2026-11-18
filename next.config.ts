import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // The site opens on Hill. Hunt used to be the whole site, so its old trends URL still works.
  redirects: async () => [
    { source: "/", destination: "/hill", permanent: false },
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

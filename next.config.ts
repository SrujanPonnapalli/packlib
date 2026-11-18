import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // The site opens on Hill. Hunt was the whole site before Hill, so its old trends address keeps working.
  redirects: async () => [
    { source: "/", destination: "/hill", permanent: false },
    { source: "/trends", destination: "/hunt/trends", permanent: false },
  ],
  images: {
    // Space photos are served by NC State Libraries.
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

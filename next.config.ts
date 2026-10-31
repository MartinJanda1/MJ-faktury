import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local SQLite reads must stay per-request. Cache Components would
  // snapshot better-sqlite3 during prerender.
  serverExternalPackages: ["better-sqlite3"],
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the prototype has no backend and can be hosted on any static host.
  output: "export",
  trailingSlash: true,
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

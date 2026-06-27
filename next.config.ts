import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, the parent directory's
  // lockfile makes Next infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;

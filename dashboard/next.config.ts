import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray package-lock.json in the parent dir makes Next infer the wrong
    // workspace root; pin it to this project.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

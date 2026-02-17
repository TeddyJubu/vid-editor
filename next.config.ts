import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    // Explicitly set the workspace root to avoid Next.js inferring a parent directory
    // when unrelated lockfiles exist outside this repo.
    root: process.cwd(),
  },
};

export default nextConfig;

import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..");
const hasMonorepoRoot =
  fs.existsSync(path.join(monorepoRoot, "package.json")) &&
  path.resolve(monorepoRoot) !== path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Only set when the parent folder is the real repo root (local monorepo).
  // Vercel "Root Directory = dashboard" deployments often have no parent package.json — tracing root `..` breaks the build (exit 2).
  ...(hasMonorepoRoot ? { outputFileTracingRoot: monorepoRoot } : {})
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  allowedDevOrigins: ["10.2.3.44"],
  // Lean, self-contained build for deploying to a VPS (see DEPLOY.md) — bundles only the
  // production dependencies actually used into .next/standalone.
  output: "standalone",
};

export default nextConfig;

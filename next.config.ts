import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  allowedDevOrigins: ["10.2.3.44"],
};

export default nextConfig;

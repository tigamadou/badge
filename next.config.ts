import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  allowedDevOrigins: ["badge.local", "pma.badge.local", "mail.badge.local"],
};

export default nextConfig;

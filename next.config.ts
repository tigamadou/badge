import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  allowedDevOrigins: ["192.168.1.5"],
};

export default nextConfig;

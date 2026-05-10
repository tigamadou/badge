import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  allowedDevOrigins: ["192.168.1.2", "c05a-154-66-143-249.ngrok-free.app"],
};

export default nextConfig;

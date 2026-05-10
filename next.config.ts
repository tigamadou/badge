import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  allowedDevOrigins: ["192.168.1.2", "b9f7-154-66-143-249.ngrok-free.app"],
};

export default nextConfig;

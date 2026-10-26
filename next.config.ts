import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@tigamadou/pdf-engine"],
  // Polices TTF lues par montserratFaces() au runtime : le tracage ne les voit pas.
  outputFileTracingIncludes: { "/**": ["./node_modules/@tigamadou/pdf-engine/fonts/**"] },
  allowedDevOrigins: ["badge.local", "pma.badge.local", "mail.badge.local"],
};

export default nextConfig;

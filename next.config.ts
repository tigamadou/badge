import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@tigamadou/pdf-engine"],
  // Polices TTF lues par montserratFaces() au runtime : le tracage ne les voit pas.
  outputFileTracingIncludes: { "/**": ["./node_modules/@tigamadou/pdf-engine/fonts/**"] },
  allowedDevOrigins: ["badge.local", "pma.badge.local", "mail.badge.local"],
  async redirects() {
    return [
      { source: "/platform/print/requests", destination: "/platform/print/orders", permanent: true },
      { source: "/platform/print/requests/:path*", destination: "/platform/print/orders/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

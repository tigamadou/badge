"use client";

import dynamic from "next/dynamic";

const ScanPageClient = dynamic(() => import("./ScanPageClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-transparent mb-4" />
      <p className="text-lg">Chargement...</p>
    </div>
  ),
});

export default function ScanDynamic() {
  return <ScanPageClient />;
}

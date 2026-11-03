"use client";

import { usePathname } from "next/navigation";
import { TabLinks } from "@/components/ui/TabLinks";

const BASE = "/platform/print/sheets";

// Onglets des sous-pages : l'onglet actif suit l'URL.
export function SheetsTabs({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const value = pathname.startsWith(`${BASE}/generated`) ? "generated" : pathname.startsWith(`${BASE}/free`) ? "free" : "pending";
  return (
    <TabLinks
      label="Sous-pages des planches"
      value={value}
      tabs={[
        { value: "pending", label: `À traiter (${pendingCount})`, href: `${BASE}/pending` },
        { value: "generated", label: "Générées", href: `${BASE}/generated` },
        { value: "free", label: "Génération libre", href: `${BASE}/free` },
      ]}
    />
  );
}

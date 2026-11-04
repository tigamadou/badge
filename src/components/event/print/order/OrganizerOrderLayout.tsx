"use client";

import type { ReactNode } from "react";
import { OrderTabs } from "@/components/print/OrderTabs";
import { useIsWide } from "@/components/print/useIsWide";

// Trois colonnes à partir de `xl`, onglets Infos / Discussion / Devis en dessous (Discussion par défaut).
export function OrganizerOrderLayout({
  summary,
  conversation,
  quote,
}: {
  summary: ReactNode;
  conversation: ReactNode;
  quote: ReactNode;
}) {
  const wide = useIsWide();
  if (wide) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_340px] gap-4 p-4">
        <div className="min-h-0 overflow-y-auto">{summary}</div>
        <section className="flex min-h-0 min-w-0 flex-col" aria-label="Échanges avec l'équipe Badge">
          {conversation}
        </section>
        <div className="min-h-0 overflow-y-auto">{quote}</div>
      </div>
    );
  }
  return (
    <OrderTabs
      defaultId="discussion"
      tabs={[
        { id: "infos", label: "Infos", panel: <div className="p-3">{summary}</div> },
        {
          id: "discussion",
          label: "Discussion",
          panel: (
            <section className="flex min-h-0 flex-1 flex-col p-3" aria-label="Échanges avec l'équipe Badge">
              {conversation}
            </section>
          ),
        },
        { id: "quote", label: "Devis", panel: <div className="p-3">{quote}</div> },
      ]}
    />
  );
}
